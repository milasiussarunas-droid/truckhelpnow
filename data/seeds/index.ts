/**
 * Re-export all seed data and types for the loader.
 * Import from here for a single entry point.
 */

export type {
  BrandSeedRow,
  EcuModuleSeedRow,
  CanonicalFaultSeedRow,
  FaultAliasSeedRow,
  ProcedureSeedRow,
  FaultProcedureLinkSeedRow,
} from './seed-types'

export { brands } from './brands.seed'
export { ecuModules } from './ecu-modules.seed'
export { canonicalFaults } from './canonical-faults.seed'
export { faultAliases } from './fault-aliases.seed'
export { procedures } from './procedures.seed'
export { faultProcedureLinks } from './fault-procedure-links.seed'
