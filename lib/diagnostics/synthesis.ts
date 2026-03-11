/**
 * Answer synthesis helpers for Volvo/diagnostic queries.
 * Query-type detection and evidence trust so the model can produce
 * clearer, more actionable shop-level answers from retrieved KB evidence.
 * Server-side only.
 */

import type {
  DiagnosticKbRow,
  ExtractedTruckEvidence,
  ResolvedTruckFaultContext,
} from '@/lib/diagnostics/types'

/** Inferred query type for synthesis instructions. */
export type DiagnosticQueryType =
  | 'exact_obd_pcode'
  | 'spn_fmi'
  | 'recall_campaign'
  | 'electrical_ecu'
  | 'general_symptom'

/** Trust tier for a KB row based on provenance. */
export type EvidenceTrust = 'high' | 'medium' | 'low'

const PROVENANCE_HIGH_TRUST = [
  'oem',
  'recall',
  'bulletin',
  'tsb',
  'electrical_ecu_manual',
  'electrical_ecu',
  'wiring',
  'manual',
  'service manual',
  'workshop',
  'manufacturer',
  'service bulletin',
]
const PROVENANCE_LOW_TRUST = ['forum', 'discussion', 'thread', 'post', 'user post', 'community']

/**
 * Normalize provenance for stable trust/label classification.
 * Lowercase, trim, collapse repeated spaces; keeps original for display where needed.
 */
export function normalizeProvenanceForConsistency(provenance: string | null | undefined): string {
  if (provenance == null) return ''
  return provenance.trim().toLowerCase().replace(/\s+/g, ' ')
}

/**
 * Classify evidence trust from provenance string.
 * High: OEM docs, recalls, bulletins, electrical/VECU manuals, wiring.
 * Low: forum/discussion (use as secondary only).
 * Medium: everything else.
 * Uses normalized provenance for consistent categorization.
 */
export function classifyEvidenceTrust(provenance: string | null | undefined): EvidenceTrust {
  const p = normalizeProvenanceForConsistency(provenance)
  if (!p) return 'medium'
  for (const term of PROVENANCE_HIGH_TRUST) {
    if (p.includes(term)) return 'high'
  }
  for (const term of PROVENANCE_LOW_TRUST) {
    if (p.includes(term)) return 'low'
  }
  return 'medium'
}

/**
 * Infer query type from extracted evidence and optional message.
 * Used to tailor synthesis (exact code vs symptom vs electrical/VECU).
 */
export function inferDiagnosticQueryType(
  extracted: ExtractedTruckEvidence,
  userMessage?: string | null
): DiagnosticQueryType {
  const msg = (userMessage ?? '').toLowerCase()
  const hasSpnFmi = extracted.spnFmiCandidates.length > 0
  const hasRawCodes = (extracted.rawCodes?.length ?? 0) > 0
  const hasEcuLabels = (extracted.ecuLabels?.length ?? 0) > 0

  const recallLike = /\b(recall|campaign|service campaign|bulletin|tsb)\b/i.test(msg)
  const electricalLike =
    /\b(vecu|electrical|wiring|section\s*3|ecu|connector|harness|fuse)\b/i.test(msg) || hasEcuLabels

  if (recallLike) return 'recall_campaign'
  if (electricalLike && (hasEcuLabels || /vecu|electrical|wiring|section\s*3/i.test(msg)))
    return 'electrical_ecu'
  if (hasSpnFmi) return 'spn_fmi'
  if (hasRawCodes && /^[PC]\d+[0-9A-Za-z]*$/i.test(extracted.rawCodes[0] ?? '')) return 'exact_obd_pcode'
  return 'general_symptom'
}

/**
 * Short synthesis-instruction block for the model based on query type.
 * Injected into the prompt so answers follow a consistent structure.
 */
export function getSynthesisInstructionsForQueryType(queryType: DiagnosticQueryType): string {
  const faithfulness =
    ' Do not add claims that are not supported by the KB block below; when the KB is empty or weak, state limited coverage and what is uncertain.'
  switch (queryType) {
    case 'exact_obd_pcode':
      return `QUERY TYPE: Exact OBD/P-code. Structure your answer as: (1) what this code likely means; (2) likely causes; (3) what to inspect/check first; (4) supporting evidence from the retrieved docs; (5) confidence/caveats if evidence is weak or mixed. Be specific from the KB; avoid generic filler.${faithfulness}`
    case 'spn_fmi':
      return `QUERY TYPE: SPN/FMI. Structure your answer as: (1) what this SPN/FMI typically indicates; (2) likely causes; (3) what to inspect/check first; (4) supporting evidence from the retrieved docs; (5) confidence/caveats if evidence is weak or mixed. Prefer OEM/technical sources over forum when both exist.${faithfulness}`
    case 'recall_campaign':
      return `QUERY TYPE: Recall/campaign. Emphasize: campaign/recall identification, affected vehicles/conditions, and recommended action (e.g. dealer fix, inspection). Cite bulletin/recall sources when present.${faithfulness}`
    case 'electrical_ecu':
      return `QUERY TYPE: Electrical/VECU/section. Focus on: circuit/subsystem involved, wiring/connector checks, and VECU/electrical manual references. Prioritize electrical_ecu_manual and wiring docs; use forum only as secondary.${faithfulness}`
    case 'general_symptom':
      return `QUERY TYPE: General symptom. Structure: (1) what the described symptom often indicates; (2) likely causes; (3) what to inspect/check first; (4) supporting evidence from retrieved docs; (5) confidence/caveats. Tie every recommendation to the retrieved evidence where possible.${faithfulness}`
    default:
      return `Structure your answer: (1) what the code/query likely means; (2) likely causes; (3) what to inspect/check first; (4) supporting evidence from retrieved docs; (5) confidence/caveats if evidence is weak or mixed.${faithfulness}`
  }
}

/** Single line for prompt: required diagnostic answer structure (for consistency). */
export const REQUIRED_ANSWER_STRUCTURE =
  'For every diagnostic answer use this structure: most_likely_problem = likely meaning + problem summary; possible_causes = likely causes; recommended_checks_immediate = first checks to do; cite supporting evidence from the KB in your text; overall_confidence and missing_information = confidence/caveats (set confidence to low when KB is weak or empty).'

/**
 * When evidence is weak or mixed, instruct the model to explicitly state what is supported, what is uncertain, and what would help.
 * Reduces generic filler and makes it clear when the answer is limited by evidence.
 */
export function getWeakEvidenceInstruction(strength: EvidenceStrength): string {
  if (strength === 'strong') return ''
  return (
    '\n\nWEAK/MIXED EVIDENCE: In your answer you must explicitly state: (1) what is supported by the KB above; (2) what is uncertain or not covered; (3) what additional codes or information would help (e.g. full code, SPN/FMI, vehicle details). Put these in most_likely_problem and/or missing_information. Do not repeat generic diagnostic filler.'
  )
}

/** True when the query has no or very few KB matches (unresolved codes and empty/small diagnostic KB and canonical set). */
export function isNoMatchOrLowMatch(ctx: ResolvedTruckFaultContext): boolean {
  const unresolved = ctx.unresolvedCodes?.length ?? 0
  const kbCount = ctx.matchedDiagnosticKb?.length ?? 0
  const canonicalCount = ctx.rankedCanonicalFaults?.length ?? 0
  if (unresolved === 0) return false
  if (kbCount > 1 || canonicalCount > 0) return false
  return true
}

/**
 * Strong instruction for no-match or low-match: do not invent exact causes; separate supported vs not covered vs what would help.
 * Used for rare SPN/FMI, rare OBD/P-codes, partial D13, symptom-only with thin retrieval.
 */
export function getNoMatchLowMatchInstruction(ctx: ResolvedTruckFaultContext): string {
  if (!isNoMatchOrLowMatch(ctx)) return ''
  return (
    '\n\nNO MATCH / LOW MATCH: The code(s) or query have no or very few KB matches above. Do not state exact causes unless they appear in the KB. You must clearly separate: (1) what is supported by the KB (if anything); (2) what is not covered; (3) what would narrow it down (exact code from scanner, full SPN/FMI, D13 subcode, when symptom occurs). Set overall_confidence to low. Be useful: give next-step guidance (e.g. read full code, note conditions) without inventing causes.'
  )
}

/**
 * Sort and optionally annotate diagnostic KB rows by evidence trust.
 * Puts high-trust (OEM, recall, electrical manual, wiring) first; forum last.
 */
export function sortDiagnosticKbByTrust(rows: DiagnosticKbRow[]): DiagnosticKbRow[] {
  const tier = (r: DiagnosticKbRow): number => {
    const t = classifyEvidenceTrust(r.provenance)
    return t === 'high' ? 0 : t === 'medium' ? 1 : 2
  }
  return [...rows].sort((a, b) => tier(a) - tier(b))
}

/**
 * Format provenance for display with a trust hint (for the model).
 * e.g. "OEM manual (high trust)" or "forum (use as secondary)".
 */
export function formatProvenanceWithTrust(provenance: string | null | undefined): string {
  if (!provenance?.trim()) return ''
  const t = classifyEvidenceTrust(provenance)
  if (t === 'high') return `${provenance.trim()} (high-trust source; prefer in summary).`
  if (t === 'low') return `${provenance.trim()} (secondary/supporting only; not primary authority).`
  return provenance.trim()
}

/** Human-readable source label for UI (concise, not noisy). Order: OEM first, then recall, wiring, forum. */
const PROVENANCE_TO_LABEL: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\b(oem|manufacturer|service manual|workshop manual|volvo manual)\b/i, label: 'OEM manual' },
  { pattern: /\b(recall|bulletin|tsb|service campaign|service bulletin)\b/i, label: 'Recall / bulletin' },
  { pattern: /\b(wiring|electrical_ecu_manual|electrical manual|harness|electrical_ecu)\b/i, label: 'Wiring / electrical manual' },
  { pattern: /\b(forum|discussion|thread|post|user post|community)\b/i, label: 'Forum discussion' },
]

/**
 * Build concise, readable source labels from diagnostic KB rows (for reply and UI).
 * Uses normalized provenance for stable labels; deduplicates so we show "OEM manual; Wiring / electrical manual".
 */
export function getSourceLabelsForDisplay(rows: DiagnosticKbRow[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const r of rows) {
    const p = normalizeProvenanceForConsistency(r.provenance)
    if (!p) continue
    for (const { pattern, label } of PROVENANCE_TO_LABEL) {
      if (pattern.test(p) && !seen.has(label)) {
        seen.add(label)
        out.push(label)
        break
      }
    }
  }
  return out
}

/** Evidence strength for confidence signaling (strong / mixed / weak). */
export type EvidenceStrength = 'strong' | 'mixed' | 'weak'

/**
 * Compute evidence strength from resolved context for confidence signaling.
 * Strong: high-trust KB items present and no ambiguity; mixed: high + low trust or ambiguous ranking; weak: few/no matches or many unresolved.
 */
export function getEvidenceStrength(ctx: ResolvedTruckFaultContext): EvidenceStrength {
  const kb = ctx.matchedDiagnosticKb ?? []
  const sorted = sortDiagnosticKbByTrust(kb)
  const hasHighTrust = sorted.some((r) => classifyEvidenceTrust(r.provenance) === 'high')
  const hasLowTrust = sorted.some((r) => classifyEvidenceTrust(r.provenance) === 'low')
  const unresolvedCount = ctx.unresolvedCodes?.length ?? 0
  const ranked = ctx.rankedCanonicalFaults ?? []
  const topTwoClose = ranked.length >= 2 && ranked[0].score - ranked[1].score <= 8

  if (kb.length === 0 && ranked.length === 0) return 'weak'
  if (unresolvedCount > 0 && kb.length === 0) return 'weak'
  if (hasHighTrust && !hasLowTrust && !topTwoClose && unresolvedCount === 0) return 'strong'
  if (hasHighTrust && hasLowTrust) return 'mixed'
  if (topTwoClose || unresolvedCount > 0) return 'mixed'
  if (hasHighTrust) return 'strong'
  if (kb.length > 0 || ranked.length > 0) return 'mixed'
  return 'weak'
}

/**
 * Build a one-line summary for the reply: "Sources: OEM manual; Wiring / electrical manual."
 * Returns empty string if no labels.
 */
export function formatSourcesLine(labels: string[]): string {
  if (labels.length === 0) return ''
  return 'Sources: ' + labels.join('; ') + '.'
}

/**
 * Build a one-line evidence strength summary for the reply.
 */
export function formatEvidenceStrengthLine(strength: EvidenceStrength): string {
  switch (strength) {
    case 'strong':
      return 'Evidence: strong (high-trust docs used).'
    case 'mixed':
      return 'Evidence: mixed (multiple or ambiguous sources).'
    case 'weak':
      return 'Evidence: limited (few or no matching docs).'
    default:
      return ''
  }
}

/** Single KB item as shown in debug inspection (order, provenance, trust, snippet, source_label). */
export interface DebugInspectionKbItem {
  order: number
  display_code: string | null
  provenance: string | null
  trust: EvidenceTrust
  source_label: string | null
  snippet: string
}

/** Get the display source label for a single row (OEM manual, Recall / bulletin, etc.). */
function getSourceLabelForRow(row: DiagnosticKbRow): string | null {
  const p = normalizeProvenanceForConsistency(row.provenance)
  if (!p) return null
  for (const { pattern, label } of PROVENANCE_TO_LABEL) {
    if (pattern.test(p)) return label
  }
  return null
}

/**
 * Build debug-friendly list of KB items that were provided to synthesis (order, provenance, trust, source_label, snippet).
 * Used when THN_DEBUG or NODE_ENV=development and request asks for debug payload.
 */
export function buildDebugInspectionKb(kbRows: DiagnosticKbRow[]): DebugInspectionKbItem[] {
  const sorted = sortDiagnosticKbByTrust(kbRows)
  return sorted.map((r, i) => {
    const snippet = [r.title, r.description].filter(Boolean).join(' ').slice(0, 80)
    return {
      order: i + 1,
      display_code: r.display_code ?? r.canonical_fault_code ?? null,
      provenance: r.provenance ?? null,
      trust: classifyEvidenceTrust(r.provenance),
      source_label: getSourceLabelForRow(r),
      snippet: (snippet && snippet + (snippet.length >= 80 ? '…' : '')) || '—',
    }
  })
}

/** Top N items by trust order for "strongest items" debug summary (reviewers check if answer references these). */
export const DEBUG_STRONGEST_ITEMS_COUNT = 3

/**
 * First N items from the trust-sorted KB list for debug summary.
 * Reviewers can check whether the final answer references these strongest items.
 */
export function getStrongestItemsForDebug(kbRows: DiagnosticKbRow[]): DebugInspectionKbItem[] {
  const full = buildDebugInspectionKb(kbRows)
  return full.slice(0, DEBUG_STRONGEST_ITEMS_COUNT)
}
