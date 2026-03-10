/**
 * Knowledge-resolution service for the truck diagnostic layer.
 * Orchestrates retrieval into a single evidence-based context for chat/image analysis.
 * Server-side only; do not import from client code.
 */

import type {
  CanonicalFault,
  FaultAlias,
  FaultBrandOverride,
  ModuleDefinition,
  Procedure,
  ResolvedTruckFaultContext,
  TruckFaultEvidenceInput,
} from '@/lib/diagnostics/types'
import { rankCanonicalFaults } from '@/lib/diagnostics/ranking'
import {
  findFaultAliasesByRawCode,
  getBrandByNameOrSlug,
  getBrandOverrideForFault,
  getCanonicalFaultByCode,
  getCanonicalFaultById,
  getCanonicalFaultBySpnFmi,
  getEcuModuleByCode,
  getProceduresForCanonicalFault,
} from '@/lib/diagnostics/retrieval'

/**
 * Resolve structured truck fault evidence into a typed context of matched
 * brands, modules, aliases, canonical faults, procedures, and overrides.
 * Preserves multiple matches; does not force a single diagnosis.
 */
export async function resolveTruckFaultContext(
  input: TruckFaultEvidenceInput
): Promise<ResolvedTruckFaultContext> {
  const rawCodes = input.rawCodes?.filter((c) => c?.trim()) ?? []
  const ecuLabels = input.ecuLabels?.filter((l) => l?.trim()) ?? []
  const spnFmiCandidates = input.spnFmiCandidates ?? []
  const suspectedBrand = input.suspectedBrand?.trim() || null

  const matchedBrand = suspectedBrand ? await getBrandByNameOrSlug(suspectedBrand) : null

  const matchedModules: ModuleDefinition[] = []
  const seenModuleId = new Set<string>()
  for (const label of ecuLabels) {
    const mod = await getEcuModuleByCode(label)
    if (mod && !seenModuleId.has(mod.id)) {
      seenModuleId.add(mod.id)
      matchedModules.push(mod)
    }
  }

  const matchedAliases: FaultAlias[] = []
  const canonicalFaultIds = new Set<string>()
  const resolvedByCode = new Map<string, CanonicalFault | null>()

  for (const raw of rawCodes) {
    const aliases = await findFaultAliasesByRawCode(raw)
    for (const a of aliases) {
      matchedAliases.push(a)
      canonicalFaultIds.add(a.canonical_fault_id)
    }
    const byCode = await getCanonicalFaultByCode(raw)
    if (byCode) {
      canonicalFaultIds.add(byCode.id)
      resolvedByCode.set(raw, byCode)
    }
  }

  for (const { spn, fmi } of spnFmiCandidates) {
    const fault = await getCanonicalFaultBySpnFmi(spn, fmi)
    if (fault) canonicalFaultIds.add(fault.id)
  }

  const matchedCanonicalFaults: CanonicalFault[] = []
  const seenFaultId = new Set<string>()
  for (const fid of canonicalFaultIds) {
    if (seenFaultId.has(fid)) continue
    const fault = await getCanonicalFaultById(fid)
    if (fault && !seenFaultId.has(fault.id)) {
      seenFaultId.add(fault.id)
      matchedCanonicalFaults.push(fault)
    }
  }

  const matchedProcedures: Procedure[] = []
  const seenProcId = new Set<string>()
  for (const fault of matchedCanonicalFaults) {
    const procs = await getProceduresForCanonicalFault(fault.id)
    for (const p of procs) {
      if (!seenProcId.has(p.id)) {
        seenProcId.add(p.id)
        matchedProcedures.push(p)
      }
    }
  }

  const matchedBrandOverrides: FaultBrandOverride[] = []
  if (matchedBrand) {
    for (const fault of matchedCanonicalFaults) {
      const override = await getBrandOverrideForFault(fault.id, matchedBrand.id)
      if (override) matchedBrandOverrides.push(override)
    }
  }

  const unresolvedCodes = rawCodes.filter((raw) => {
    const hasAlias = matchedAliases.some((a) => a.alias_code === raw.trim())
    const hasDirect = resolvedByCode.get(raw) != null
    return !hasAlias && !hasDirect
  })

  const evidenceSummary: string[] = []
  if (matchedCanonicalFaults.length > 0) {
    evidenceSummary.push(`Matched ${matchedCanonicalFaults.length} canonical fault(s): ${matchedCanonicalFaults.map((f) => f.code).join(', ')}.`)
  }
  if (matchedBrand) {
    evidenceSummary.push(`Brand: ${matchedBrand.name} (${matchedBrand.slug}).`)
  }
  if (matchedAliases.length > 0) {
    evidenceSummary.push(`${matchedAliases.length} fault alias(es) resolved to canonical fault(s).`)
  }
  if (unresolvedCodes.length > 0) {
    evidenceSummary.push(`Unresolved code(s): ${unresolvedCodes.join(', ')}.`)
  }
  if (evidenceSummary.length === 0 && (rawCodes.length > 0 || spnFmiCandidates.length > 0)) {
    evidenceSummary.push('No knowledge-base matches for the given codes or SPN/FMI.')
  }

  const confidenceNotes: string[] = []
  if (matchedAliases.length > 1 && new Set(matchedAliases.map((a) => a.alias_code)).size < matchedAliases.length) {
    const byAlias = matchedAliases.reduce<Record<string, number>>((acc, a) => {
      acc[a.alias_code] = (acc[a.alias_code] ?? 0) + 1
      return acc
    }, {})
    const multi = Object.entries(byAlias).filter(([, n]) => n > 1)
    if (multi.length > 0) {
      confidenceNotes.push(`Multiple canonical faults map to the same raw code in some cases: ${multi.map(([c]) => c).join(', ')}.`)
    }
  }
  if (spnFmiCandidates.length > 0 && matchedCanonicalFaults.length === 0) {
    confidenceNotes.push('SPN/FMI candidate(s) did not match any canonical fault in the knowledge base.')
  }
  if (suspectedBrand && !matchedBrand) {
    confidenceNotes.push(`Brand "${suspectedBrand}" not found; brand-specific overrides not applied.`)
  }

  const rankedCanonicalFaults = rankCanonicalFaults({
    faults: matchedCanonicalFaults,
    rawCodes,
    spnFmiCandidates,
    matchedAliases,
    resolvedByCode,
    matchedModules,
    matchedBrandOverrides,
  })

  return {
    matchedBrand,
    matchedModules,
    matchedAliases,
    matchedCanonicalFaults,
    matchedProcedures,
    matchedBrandOverrides,
    rankedCanonicalFaults,
    evidenceSummary,
    confidenceNotes,
    unresolvedCodes,
  }
}
