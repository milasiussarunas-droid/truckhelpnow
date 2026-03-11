/**
 * Truck diagnostic knowledge layer — domain types only.
 * Designed for Supabase/Postgres; IDs are UUIDs, timestamps are ISO strings.
 * Do not import app routes or UI; safe to use from API routes, scripts, and server code.
 */

// ─── Shared enums and string literal unions ─────────────────────────────────

export type TruckBrandName =
  | 'Freightliner'
  | 'Peterbilt'
  | 'Kenworth'
  | 'International'
  | 'Volvo'
  | 'Mack'
  | 'Western Star'
  | 'Navistar'
  | 'Cummins'
  | 'Detroit'
  | 'PACCAR'
  | 'Other'

export type DiagnosticSubsystem =
  | 'aftertreatment'
  | 'engine'
  | 'transmission'
  | 'brakes'
  | 'steering'
  | 'electrical'
  | 'fuel'
  | 'cooling'
  | 'emissions'
  | 'suspension'
  | 'cab_body'
  | 'safety'
  | 'other'

export type SeverityLevel = 'low' | 'medium' | 'high' | 'critical'

export type DriveabilityLevel =
  | 'normal'
  | 'derate'
  | 'limp_home'
  | 'no_start'
  | 'stop_safely'
  | 'unknown'

export type ProcedureAudience = 'driver' | 'technician' | 'shop'

export type EvidenceConfidence = 'low' | 'medium' | 'high'

/** Confidence tier for ranked fault matches (deterministic scoring). */
export type RankedMatchConfidence = 'low' | 'medium' | 'high'

export type EvidenceRuleStatus = 'active' | 'draft' | 'deprecated'

export type FaultCodeType = 'spn_fmi' | 'p_code' | 'obd2' | 'proprietary' | 'other'

export type SourceDocumentType = 'manual' | 'tsb' | 'bulletin' | 'spec' | 'other'

// ─── Brand ─────────────────────────────────────────────────────────────────

export interface Brand {
  id: string
  name: TruckBrandName | string
  slug: string
  created_at: string
  updated_at: string
}

// ─── Module (ECU / controller) ──────────────────────────────────────────────

export interface ModuleDefinition {
  id: string
  name: string
  code: string
  subsystem: DiagnosticSubsystem
  description: string | null
  created_at: string
  updated_at: string
}

// ─── Canonical fault (SPN/FMI, P-code, etc.) ───────────────────────────────

export interface CanonicalFault {
  id: string
  code: string
  code_type: FaultCodeType
  spn: number | null
  fmi: number | null
  subsystem: DiagnosticSubsystem
  title: string
  description: string | null
  severity: SeverityLevel
  driveability: DriveabilityLevel
  module_id: string | null
  created_at: string
  updated_at: string
}

// ─── Fault alias (alternate codes for same fault) ────────────────────────────

export interface FaultAlias {
  id: string
  canonical_fault_id: string
  alias_code: string
  alias_type: FaultCodeType
  created_at: string
}

// ─── Brand-specific fault override ──────────────────────────────────────────

export interface FaultBrandOverride {
  id: string
  canonical_fault_id: string
  brand_id: string
  override_title: string | null
  override_description: string | null
  override_severity: SeverityLevel | null
  override_driveability: DriveabilityLevel | null
  created_at: string
  updated_at: string
}

// ─── Component (sensor, actuator, part) ─────────────────────────────────────

export interface Component {
  id: string
  name: string
  subsystem: DiagnosticSubsystem
  oem_part_number: string | null
  description: string | null
  created_at: string
  updated_at: string
}

// ─── Fault ↔ Component link ────────────────────────────────────────────────

export type FaultComponentRole = 'affected' | 'related' | 'cause' | 'sensor'

export interface FaultComponentLink {
  id: string
  fault_id: string
  component_id: string
  role: FaultComponentRole
  created_at: string
}

// ─── Procedure (diagnostic or repair step set) ───────────────────────────────

export interface Procedure {
  id: string
  title: string
  audience: ProcedureAudience
  summary: string | null
  source_document_id: string | null
  created_at: string
  updated_at: string
  /** From DB: steps, tools_required, safety_notes, stop_conditions (JSONB). */
  steps?: unknown[]
  tools_required?: unknown[]
  safety_notes?: unknown[]
  stop_conditions?: unknown[]
}

// ─── Fault ↔ Procedure link ─────────────────────────────────────────────────

export interface FaultProcedureLink {
  id: string
  fault_id: string
  procedure_id: string
  sort_order: number
  created_at: string
}

// ─── Symptom (observable driver/tech symptom) ────────────────────────────────

export interface Symptom {
  id: string
  name: string
  description: string | null
  subsystem: DiagnosticSubsystem | null
  created_at: string
  updated_at: string
}

// ─── Fault ↔ Symptom link ───────────────────────────────────────────────────

export interface FaultSymptomLink {
  id: string
  fault_id: string
  symptom_id: string
  created_at: string
}

// ─── Source document (OEM manual, TSB, bulletin) ────────────────────────────

export interface SourceDocument {
  id: string
  title: string
  document_type: SourceDocumentType
  brand_id: string | null
  url: string | null
  external_id: string | null
  created_at: string
  updated_at: string
}

// ─── Evidence rule (when to cite knowledge; RAG/retrieval) ──────────────────

export interface EvidenceRule {
  id: string
  name: string
  /** Structured condition (e.g. subsystem, code pattern, symptom keys). Stored as JSONB in Postgres. */
  condition: Record<string, unknown>
  confidence: EvidenceConfidence
  status: EvidenceRuleStatus
  created_at: string
  updated_at: string
}

// ─── Ranked fault match (scoring layer) ────────────────────────────────────────

export interface RankedCanonicalFault {
  fault: CanonicalFault
  score: number
  reasons: string[]
  confidence: RankedMatchConfidence
}

// ─── Knowledge resolution (input/output for knowledge-service) ─────────────────

export interface SpnFmiCandidate {
  spn: number
  fmi: number
  confidence?: string
}

/** Result of evidence extraction from text; can be merged into TruckFaultEvidenceInput. */
export interface ExtractedTruckEvidence {
  rawCodes: string[]
  ecuLabels: string[]
  spnFmiCandidates: SpnFmiCandidate[]
  suspectedBrand: string | null
  extractionNotes: string[]
}

export interface TruckFaultEvidenceInput {
  /** Raw or display codes (e.g. P20EE, 4364/18, "SPN 4364 FMI 18"). */
  rawCodes?: string[]
  /** ECU/module labels mentioned (e.g. ECM, ACM, TCM). */
  ecuLabels?: string[]
  /** Suspected truck brand name or slug for brand-specific overrides. */
  suspectedBrand?: string | null
  /** Visible text from image or scanner (for context; not yet used for matching). */
  visibleText?: string[]
  /** Free-text user message (for context; not yet used for matching). */
  userMessage?: string | null
  /** Parsed SPN/FMI pairs, e.g. from image or message. */
  spnFmiCandidates?: SpnFmiCandidate[]
}

/** Row from truck_diagnostic_kb (additional KB source; may have different column names in DB). */
export interface DiagnosticKbRow {
  id: string
  /** Raw/display code as shown (e.g. P20EE, 4364/18). */
  display_code?: string | null
  /** Normalized code (e.g. SPN 4364 FMI 18). */
  canonical_fault_code?: string | null
  /** Brand slug when row is brand-specific (e.g. volvo). */
  brand_slug?: string | null
  spn?: number | null
  fmi?: number | null
  title?: string | null
  description?: string | null
  /** When true, treat as partial/incomplete match. */
  is_partial?: boolean | null
  /** Source or provenance (e.g. document id, manual name). */
  provenance?: string | null
}

export interface ResolvedTruckFaultContext {
  matchedBrand: Brand | null
  matchedModules: ModuleDefinition[]
  matchedAliases: FaultAlias[]
  matchedCanonicalFaults: CanonicalFault[]
  /** Procedures linked to any of the matched faults (ordered by fault link sort_order). */
  matchedProcedures: Procedure[]
  /** Brand overrides for (fault, brand) where both were matched. */
  matchedBrandOverrides: FaultBrandOverride[]
  /** Ranked canonical faults with score, reasons, and confidence (derived from matched set). */
  rankedCanonicalFaults: RankedCanonicalFault[]
  /** Additional matches from truck_diagnostic_kb (e.g. Volvo rows). */
  matchedDiagnosticKb: DiagnosticKbRow[]
  evidenceSummary: string[]
  confidenceNotes: string[]
  /** Raw codes that did not match any alias or canonical fault. */
  unresolvedCodes: string[]
}
