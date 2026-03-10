/**
 * Test-case schema for TruckHelpNow diagnostic evaluation (20–50 real cases).
 * Use with docs/evaluation-plan.md. No app runtime dependency.
 */

/** Single test case: input + optional expected outcomes + notes. */
export interface DiagnosticTestCase {
  /** Unique slug (e.g. "def-warning-p20ee", "spn-4364-fmi-18"). */
  id: string
  /** User input and context. */
  input: DiagnosticTestCaseInput
  /** Optional expected outcomes for comparison (manual or scripted). */
  expected?: DiagnosticTestCaseExpected
  /** Free-form notes for reviewers (e.g. "known DEF code", "ambiguous"). */
  notes?: string
}

/** Input sent to the chat API (or simulated). */
export interface DiagnosticTestCaseInput {
  /** User message text (required; use "" for image-only cases). */
  message: string
  /** Optional local image path (relative to cwd or absolute). When set, file is sent as FormData "image". */
  imagePath?: string
  /** Whether the case includes an image (for reference; can be inferred from imagePath). */
  hasImage?: boolean
  /** Known raw codes extracted from message/image (for reference only). */
  rawCodes?: string[]
  /** Suspected brand if mentioned (for reference). */
  suspectedBrand?: string | null
}

/** Optional expectations for comparing API output to desired behavior. */
export interface DiagnosticTestCaseExpected {
  /** Expected primary subsystems (e.g. ["aftertreatment", "engine"]). */
  primarySubsystems?: string[]
  /** Key phrases that should appear in the reply (e.g. "DEF", "regeneration"). */
  replyContainsPhrases?: string[]
  /** Key phrases that should appear when there are unresolved codes. */
  acknowledgesUnresolved?: boolean
  /** When true, expect honesty note in reply if diagnosticConsistency.isConsistent is false. */
  expectHonestyNoteWhenInconsistent?: boolean
  /** Expected top canonical fault code(s) from KB (e.g. ["SPN 4364 FMI 18"]). Order optional. */
  topRankedFaultCodes?: string[]
  /** Expected safety level (e.g. "high" for critical). */
  safetyLevel?: 'low' | 'medium' | 'high'
  /** When true (e.g. for image cases), expect usedTwoPassFlow === true from the API. */
  expectTwoPassFlow?: boolean
}

/** Captured API response shape for a single run (for comparison and metrics). */
export interface DiagnosticTestRunOutput {
  /** Full reply text. */
  reply: string
  /** usedTwoPassFlow from API. */
  usedTwoPassFlow?: boolean
  /** Snapshot of ranked canonical faults (top N). */
  rankedCanonicalFaults?: Array<{
    code: string
    title: string
    score: number
    confidence: string
    reasons: string[]
  }>
  /** Unresolved codes from knowledge context. */
  unresolvedCodes?: string[]
  /** Consistency check result. */
  diagnosticConsistency: {
    isConsistent: boolean
    warnings: string[]
    severity: 'low' | 'medium'
  }
  /** Primary systems from structured response. */
  primarySystemsInvolved?: string[]
  /** Overall confidence from structured response. */
  overallConfidence?: string
  /** Safety level from structured response. */
  safetyLevel?: string
  /** Whether reply contains the honesty note (when inconsistent). */
  hasHonestyNote?: boolean
}

/** File format: array of test cases (e.g. 20–50). */
export type DiagnosticTestCaseFile = DiagnosticTestCase[]
