import type { FaultAliasSeedRow } from './seed-types'

/**
 * Starter fault aliases: raw/OEM or generic codes that map to canonical faults.
 * canonical_fault_code must match a code in canonical-faults.seed.ts.
 */
export const faultAliases: FaultAliasSeedRow[] = [
  { alias_code: 'P20EE', alias_type: 'p_code', canonical_fault_code: 'SPN 4364 FMI 18' },
  { alias_code: '4364/18', alias_type: 'spn_fmi', canonical_fault_code: 'SPN 4364 FMI 18' },
  { alias_code: 'P0420', alias_type: 'p_code', canonical_fault_code: 'SPN 3710 FMI 2' },
  { alias_code: 'P0335', alias_type: 'p_code', canonical_fault_code: 'SPN 91 FMI 3' },
  { alias_code: '91/3', alias_type: 'spn_fmi', canonical_fault_code: 'SPN 91 FMI 3' },
  { alias_code: '51-4', alias_type: 'spn_fmi', canonical_fault_code: 'SPN 51 FMI 4' },
]
