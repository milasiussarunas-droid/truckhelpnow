import type { FaultProcedureLinkSeedRow } from './seed-types'

/**
 * Links canonical faults to recommended procedures.
 * fault_code must match canonical-faults.seed.ts; procedure_code must match procedures.seed.ts.
 */
export const faultProcedureLinks: FaultProcedureLinkSeedRow[] = [
  { fault_code: 'SPN 4364 FMI 18', procedure_code: 'check-def-level', sort_order: 1 },
  { fault_code: 'SPN 3710 FMI 2', procedure_code: 'verify-dpf-regen', sort_order: 1 },
  { fault_code: 'SPN 1214 FMI 5', procedure_code: 'inspect-brake-system', sort_order: 1 },
  { fault_code: 'SPN 96 FMI 3', procedure_code: 'check-boost-pressure', sort_order: 1 },
  { fault_code: 'SPN 51 FMI 4', procedure_code: 'check-air-system', sort_order: 1 },
]
