/**
 * Lightweight rule-based consistency check: diagnosis vs knowledge context.
 * Used for debugging and tuning; does not block responses. Server-side only.
 */

export type DiagnosticConsistencySeverity = 'low' | 'medium'

export interface DiagnosticConsistencyResult {
  isConsistent: boolean
  warnings: string[]
  severity: DiagnosticConsistencySeverity
}

/** Minimal diagnostic shape needed for consistency checks. */
export interface DiagnosticConsistencyInput {
  most_likely_problem: string
  missing_information: string[]
  overall_confidence: string
  primary_systems_involved: string[]
}

/** Minimal knowledge context shape (subset of ResolvedTruckFaultContext). */
export interface ConsistencyCheckKnowledgeContext {
  rankedCanonicalFaults?: Array<{
    fault: { subsystem: string }
    score: number
  }>
  unresolvedCodes?: string[]
  matchedModules?: Array<{ subsystem: string }>
}

const RANKED_TIE_THRESHOLD = 8

const AMBIGUITY_HINTS = [
  'multiple',
  'possible',
  'may be',
  'consider',
  'either',
  ' or ',
  'plausible',
  'close',
  'uncertain',
  'ambiguous',
]

function textContainsAmbiguityHint(text: string): boolean {
  const lower = text.toLowerCase()
  return AMBIGUITY_HINTS.some((hint) => lower.includes(hint))
}

function textAcknowledgesUnresolvedOrGaps(text: string): boolean {
  const lower = text.toLowerCase()
  return (
    lower.includes('unresolved') ||
    lower.includes('not in kb') ||
    lower.includes('not in knowledge') ||
    lower.includes('not found') ||
    lower.includes('no match') ||
    lower.includes('unknown code') ||
    lower.includes('missing information') ||
    lower.includes('gaps')
  )
}

function normalizeSubsystem(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ')
}

function primaryIncludesSubsystem(primary: string[], subsystem: string): boolean {
  const sub = normalizeSubsystem(subsystem)
  return primary.some((p) => normalizeSubsystem(p).includes(sub) || sub.includes(normalizeSubsystem(p)))
}

/**
 * Runs a conservative consistency check of the structured diagnosis against
 * the knowledge context. Does not block; result is for logging and tuning.
 */
export function checkDiagnosticConsistency(
  diagnostic: DiagnosticConsistencyInput,
  knowledgeContext: ConsistencyCheckKnowledgeContext | null
): DiagnosticConsistencyResult {
  const warnings: string[] = []
  let severity: DiagnosticConsistencySeverity = 'low'

  if (!knowledgeContext) {
    return { isConsistent: true, warnings: [], severity: 'low' }
  }

  const ranked = knowledgeContext.rankedCanonicalFaults ?? []
  const unresolvedCodes = knowledgeContext.unresolvedCodes ?? []
  const matchedModules = knowledgeContext.matchedModules ?? []

  // 1. Top ranked close in score but diagnosis sounds overly certain
  if (ranked.length >= 2) {
    const [first, second] = ranked
    const topTwoClose = first.score - second.score <= RANKED_TIE_THRESHOLD
    if (topTwoClose) {
      const confidenceHigh = diagnostic.overall_confidence === 'high'
      const noAmbiguityInProblem = !textContainsAmbiguityHint(diagnostic.most_likely_problem)
      if (confidenceHigh && noAmbiguityInProblem) {
        warnings.push(
          'Top ranked matches are close in score but diagnosis sounds overly certain (high confidence, no mention of multiple possibilities).'
        )
        severity = 'medium'
      }
    }
  }

  // 2. Unresolved codes exist but missing_information does not acknowledge gaps
  if (unresolvedCodes.length > 0) {
    const missingText = diagnostic.missing_information.join(' ').toLowerCase()
    const problemText = diagnostic.most_likely_problem.toLowerCase()
    const acknowledged =
      diagnostic.missing_information.some((m) => textAcknowledgesUnresolvedOrGaps(m)) ||
      textAcknowledgesUnresolvedOrGaps(problemText)
    if (!acknowledged) {
      warnings.push(
        'Unresolved codes present in KB context but missing_information or most_likely_problem does not clearly acknowledge gaps.'
      )
      severity = 'medium'
    }
  }

  // 3. Top ranked fault suggests one subsystem but diagnosis points elsewhere without acknowledging
  if (ranked.length > 0) {
    const topSubsystem = ranked[0].fault.subsystem
    const primary = diagnostic.primary_systems_involved ?? []
    const includesTop = primaryIncludesSubsystem(primary, topSubsystem)
    if (!includesTop && topSubsystem) {
      const mentionsSubsystemOrAmbiguity =
        diagnostic.most_likely_problem.toLowerCase().includes(topSubsystem.toLowerCase()) ||
        textContainsAmbiguityHint(diagnostic.most_likely_problem)
      if (!mentionsSubsystemOrAmbiguity) {
        warnings.push(
          `Top ranked fault suggests subsystem "${topSubsystem}" but primary_systems_involved does not include it and response does not acknowledge multiple subsystems.`
        )
        severity = 'medium'
      }
    }
  }

  // 4. Matched modules suggest subsystems not reflected in primary_systems_involved
  if (matchedModules.length > 0 && diagnostic.primary_systems_involved?.length > 0) {
    const moduleSubsystems = [...new Set(matchedModules.map((m) => m.subsystem).filter(Boolean))]
    const primary = diagnostic.primary_systems_involved
    const missing = moduleSubsystems.filter((sub) => !primaryIncludesSubsystem(primary, sub))
    if (missing.length > 0) {
      warnings.push(
        `Matched ECU modules suggest subsystem(s) (${missing.join(', ')}) not reflected in primary_systems_involved.`
      )
      severity = 'medium'
    }
  }

  return {
    isConsistent: warnings.length === 0,
    warnings,
    severity,
  }
}
