/**
 * Lightweight evidence extraction from plain text for the diagnostic knowledge layer.
 * Regex-driven; conservative. Prepares structured evidence for the knowledge service.
 * Server-side only.
 */

import type { ExtractedTruckEvidence, SpnFmiCandidate } from '@/lib/diagnostics/types'

const KNOWN_ECU_LABELS = [
  'ECM', 'EECU', 'ACM', 'TCM', 'VECU', 'CPC', 'MCM', 'ICU', 'BCM', 'ABS',
] as const

const KNOWN_BRAND_NAMES = [
  'Volvo', 'Freightliner', 'Kenworth', 'International',
] as const

/** Whole-word regex for ECU labels (case-insensitive). */
const ECU_REGEX = new RegExp(
  `\\b(${KNOWN_ECU_LABELS.join('|')})\\b`,
  'gi'
)

/** Whole-word regex for brand names (case-insensitive). */
const BRAND_REGEX = new RegExp(
  `\\b(${KNOWN_BRAND_NAMES.join('|')})\\b`,
  'gi'
)

/** P-code: P followed by digits and optional alphanumeric (e.g. P1137, P20EE, P113712). */
const P_CODE_REGEX = /\b(P[0-9][0-9A-Za-z]*)\b/gi

/** SPN N FMI M with flexible spacing (e.g. "SPN 3464 FMI 7", "SPN3464 FMI7"). */
const SPN_FMI_REGEX = /SPN\s*(\d+)\s*FMI\s*(\d+)/gi

/** MID N PID N FMI N (e.g. "MID 128 PID 84 FMI 2") – capture full phrase as raw code. */
const MID_PID_FMI_REGEX = /\bMID\s*\d+\s*PID\s*\d+\s*FMI\s*\d+\b/gi

/** Digit/digit or digit-digit (e.g. "4364/18", "91-3") – treat as raw code for alias lookup. */
const DIGIT_SLASH_DIGIT_REGEX = /\b(\d+)\s*[\/-]\s*(\d+)\b/g

/**
 * Extract raw diagnostic code strings from combined text.
 * Examples: "P113712", "P1137", "SPN 3464 FMI 7", "SPN3464 FMI7", "MID 128 PID 84 FMI 2", "4364/18".
 */
export function extractRawCodes(text: string): string[] {
  if (!text?.trim()) return []
  const seen = new Set<string>()
  const add = (raw: string) => {
    const n = raw.trim()
    if (n) seen.add(n)
  }

  let m: RegExpExecArray | null
  P_CODE_REGEX.lastIndex = 0
  while ((m = P_CODE_REGEX.exec(text)) !== null) add(m[1]!)

  SPN_FMI_REGEX.lastIndex = 0
  while ((m = SPN_FMI_REGEX.exec(text)) !== null) {
    add(`SPN ${m[1]} FMI ${m[2]}`)
  }

  MID_PID_FMI_REGEX.lastIndex = 0
  while ((m = MID_PID_FMI_REGEX.exec(text)) !== null) add(m[0]!)

  DIGIT_SLASH_DIGIT_REGEX.lastIndex = 0
  while ((m = DIGIT_SLASH_DIGIT_REGEX.exec(text)) !== null) {
    add(`${m[1]}/${m[2]}`)
  }

  return Array.from(seen)
}

/**
 * Extract ECU/module labels (whole-word matches).
 * Examples: EECU, ACM, TCM, VECU, CPC, MCM, ICU, BCM, ECM, ABS.
 */
export function extractEcuLabels(text: string): string[] {
  if (!text?.trim()) return []
  const seen = new Set<string>()
  let m: RegExpExecArray | null
  ECU_REGEX.lastIndex = 0
  while ((m = ECU_REGEX.exec(text)) !== null) {
    seen.add(m[1]!.toUpperCase())
  }
  return Array.from(seen)
}

/**
 * Extract SPN/FMI number pairs from explicit "SPN N FMI M" patterns only.
 * Does not infer from P-codes or N/M patterns to avoid false confidence.
 */
export function extractSpnFmiCandidates(text: string): SpnFmiCandidate[] {
  if (!text?.trim()) return []
  const seen = new Set<string>()
  const out: SpnFmiCandidate[] = []
  let m: RegExpExecArray | null
  SPN_FMI_REGEX.lastIndex = 0
  while ((m = SPN_FMI_REGEX.exec(text)) !== null) {
    const spn = parseInt(m[1]!, 10)
    const fmi = parseInt(m[2]!, 10)
    const key = `${spn},${fmi}`
    if (!seen.has(key)) {
      seen.add(key)
      out.push({ spn, fmi, confidence: 'from_text' })
    }
  }
  return out
}

/**
 * Extract a single suspected brand from text (first whole-word match).
 * Conservative: only known names; no fuzzy or partial match.
 */
export function extractSuspectedBrand(text: string): string | null {
  if (!text?.trim()) return null
  BRAND_REGEX.lastIndex = 0
  const m = BRAND_REGEX.exec(text)
  if (!m) return null
  const name = m[1]!
  return KNOWN_BRAND_NAMES.find((b) => b.toLowerCase() === name.toLowerCase()) ?? name
}

/**
 * Combine visible text and user message into one string for extraction.
 */
function combineTextSources(visibleText: string[], userMessage: string | null): string {
  const parts: string[] = []
  if (Array.isArray(visibleText)) {
    for (const line of visibleText) {
      if (typeof line === 'string' && line.trim()) parts.push(line.trim())
    }
  }
  if (userMessage?.trim()) parts.push(userMessage.trim())
  return parts.join('\n')
}

/**
 * Extract structured truck diagnostic evidence from visible text and user message.
 * Result can be merged into TruckFaultEvidenceInput and passed to resolveTruckFaultContext.
 *
 * Example input:
 *   visibleText: ["SPN 4364 FMI 18", "DEF warning"]
 *   userMessage: "Freightliner Cascadia, check engine and EECU code P20EE"
 * Example extracted: rawCodes ["SPN 4364 FMI 18", "P20EE"], ecuLabels ["EECU"], suspectedBrand "Freightliner", spnFmiCandidates [{ spn: 4364, fmi: 18 }]
 */
export function extractTruckEvidence(
  visibleText: string[],
  userMessage: string | null
): ExtractedTruckEvidence {
  const text = combineTextSources(visibleText ?? [], userMessage ?? null)
  const extractionNotes: string[] = []

  const rawCodes = extractRawCodes(text)
  if (rawCodes.length > 0) {
    extractionNotes.push(`Extracted ${rawCodes.length} raw code(s) from text.`)
  }

  const ecuLabels = extractEcuLabels(text)
  if (ecuLabels.length > 0) {
    extractionNotes.push(`Found ECU/module label(s): ${ecuLabels.join(', ')}.`)
  }

  const spnFmiCandidates = extractSpnFmiCandidates(text)
  if (spnFmiCandidates.length > 0) {
    extractionNotes.push(`Found ${spnFmiCandidates.length} SPN/FMI pair(s) in text.`)
  }

  const suspectedBrand = extractSuspectedBrand(text)
  if (suspectedBrand) {
    extractionNotes.push(`Suspected brand from text: ${suspectedBrand}.`)
  }

  if (extractionNotes.length === 0 && text.length > 0) {
    extractionNotes.push('No diagnostic codes, ECU labels, or brand hints detected in text.')
  }

  return {
    rawCodes,
    ecuLabels,
    spnFmiCandidates,
    suspectedBrand: suspectedBrand ?? null,
    extractionNotes,
  }
}
