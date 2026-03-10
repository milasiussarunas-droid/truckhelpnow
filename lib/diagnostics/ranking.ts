/**
 * Lightweight deterministic ranking for matched canonical faults.
 * Uses existing resolution signals only; no ML. Server-side only.
 */

import type {
  CanonicalFault,
  FaultAlias,
  FaultBrandOverride,
  ModuleDefinition,
  RankedCanonicalFault,
  RankedMatchConfidence,
  SpnFmiCandidate,
} from '@/lib/diagnostics/types'

/** Input for ranking: built from ResolvedTruckFaultContext + resolution internals. */
export interface RankingInput {
  faults: CanonicalFault[]
  /** Raw codes from user/evidence. */
  rawCodes: string[]
  /** Parsed SPN/FMI pairs from evidence. */
  spnFmiCandidates: SpnFmiCandidate[]
  /** Aliases that were matched (canonical_fault_id links to fault). */
  matchedAliases: FaultAlias[]
  /** Map from raw code to canonical fault when raw matched fault.code exactly. */
  resolvedByCode: Map<string, CanonicalFault | null>
  /** ECU modules mentioned and resolved. */
  matchedModules: ModuleDefinition[]
  /** Brand overrides for (fault, brand) that were resolved. */
  matchedBrandOverrides: FaultBrandOverride[]
}

// ─── Weights (tunable; keep conservative and explainable) ───────────────────

const WEIGHT_DIRECT_CODE = 40
const WEIGHT_ALIAS_MATCH = 35
const WEIGHT_SPN_FMI = 40
const WEIGHT_ECU_ALIGNMENT = 15
const WEIGHT_BRAND_OVERRIDE = 20
const SCORE_CAP = 100

const THRESHOLD_HIGH = 70
const THRESHOLD_MEDIUM = 40

// ─── Reason labels (evidence-based, for UI/backend) ─────────────────────────

const REASON_DIRECT_CODE = 'Direct canonical code match'
const REASON_ALIAS_MATCH = 'Matched via fault alias'
const REASON_SPN_FMI = 'Exact SPN/FMI match'
const REASON_ECU_ALIGNMENT = 'ECU/module aligns with reported module(s)'
const REASON_BRAND_OVERRIDE = 'Brand-specific override available'

function toConfidence(score: number): RankedMatchConfidence {
  if (score >= THRESHOLD_HIGH) return 'high'
  if (score >= THRESHOLD_MEDIUM) return 'medium'
  return 'low'
}

/**
 * Compute a deterministic score for each matched canonical fault and return
 * ranked results with reasons and confidence. Preserves ambiguity when scores
 * are close; does not pick a single winner when evidence is weak.
 */
export function rankCanonicalFaults(input: RankingInput): RankedCanonicalFault[] {
  const {
    faults,
    rawCodes,
    spnFmiCandidates,
    matchedAliases,
    resolvedByCode,
    matchedModules,
    matchedBrandOverrides,
  } = input

  if (faults.length === 0) return []

  const faultIdsByDirectCode = new Set<string>()
  for (const [, canonical] of resolvedByCode) {
    if (canonical) faultIdsByDirectCode.add(canonical.id)
  }

  const faultIdsByAlias = new Set(matchedAliases.map((a) => a.canonical_fault_id))

  const spnFmiSet = new Set(
    spnFmiCandidates.map((c) => `${c.spn}:${c.fmi}`)
  )
  const moduleIds = new Set(matchedModules.map((m) => m.id))
  const faultIdsWithBrandOverride = new Set(
    matchedBrandOverrides.map((o) => o.canonical_fault_id)
  )

  const results: RankedCanonicalFault[] = faults.map((fault) => {
    let score = 0
    const reasons: string[] = []

    if (faultIdsByDirectCode.has(fault.id)) {
      score += WEIGHT_DIRECT_CODE
      reasons.push(REASON_DIRECT_CODE)
    }
    if (faultIdsByAlias.has(fault.id)) {
      score += WEIGHT_ALIAS_MATCH
      reasons.push(REASON_ALIAS_MATCH)
    }
    if (
      fault.spn != null &&
      fault.fmi != null &&
      spnFmiSet.has(`${fault.spn}:${fault.fmi}`)
    ) {
      score += WEIGHT_SPN_FMI
      reasons.push(REASON_SPN_FMI)
    }
    if (fault.module_id != null && moduleIds.has(fault.module_id)) {
      score += WEIGHT_ECU_ALIGNMENT
      reasons.push(REASON_ECU_ALIGNMENT)
    }
    if (faultIdsWithBrandOverride.has(fault.id)) {
      score += WEIGHT_BRAND_OVERRIDE
      reasons.push(REASON_BRAND_OVERRIDE)
    }

    const cappedScore = Math.min(score, SCORE_CAP)
    return {
      fault,
      score: cappedScore,
      reasons,
      confidence: toConfidence(cappedScore),
    }
  })

  results.sort((a, b) => b.score - a.score)
  return results
}
