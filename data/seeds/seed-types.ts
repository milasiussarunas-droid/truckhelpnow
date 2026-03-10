/**
 * Seed row types for the diagnostic knowledge layer.
 * Use human-readable keys (e.g. module_code, canonical_fault_code) for references;
 * the loader resolves these to UUIDs when inserting.
 */

export interface BrandSeedRow {
  name: string
  slug: string
}

export interface EcuModuleSeedRow {
  name: string
  code: string
  subsystem: string
  description?: string | null
}

export interface CanonicalFaultSeedRow {
  code: string
  code_type: 'spn_fmi' | 'p_code' | 'obd2' | 'proprietary' | 'other'
  spn?: number | null
  fmi?: number | null
  subsystem: string
  title: string
  description?: string | null
  severity: 'low' | 'medium' | 'high' | 'critical'
  driveability: 'normal' | 'derate' | 'limp_home' | 'no_start' | 'stop_safely' | 'unknown'
  /** Resolved to module_id by loader using ecu_modules.code */
  module_code?: string | null
}

export interface FaultAliasSeedRow {
  /** Raw or OEM display code (e.g. P20EE, 4364/18) */
  alias_code: string
  alias_type: 'spn_fmi' | 'p_code' | 'obd2' | 'proprietary' | 'other'
  /** Resolved to canonical_fault_id by loader using canonical_faults.code */
  canonical_fault_code: string
}

export interface ProcedureSeedRow {
  /** Stable key for references; do not rely on title as primary key. */
  procedure_code: string
  title: string
  audience: 'driver' | 'technician' | 'shop'
  summary?: string | null
  steps?: unknown[]
  tools_required?: unknown[]
  safety_notes?: unknown[]
  stop_conditions?: unknown[]
}

export interface FaultProcedureLinkSeedRow {
  /** Resolved to fault_id by loader using canonical_faults.code */
  fault_code: string
  /** Resolved to procedure_id by loader using procedures.procedure_code */
  procedure_code: string
  sort_order?: number
}
