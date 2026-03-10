/**
 * Load diagnostic knowledge layer seed data into Supabase.
 *
 * Prerequisites:
 * - Migration 20250309000000_diagnostic_knowledge_layer.sql applied
 * - .env.local with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
 *
 * Run: npm run seed   (or: npx tsx scripts/seed-knowledge.ts)
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { config as loadEnv } from 'dotenv'
import path from 'path'
import {
  brands,
  ecuModules,
  canonicalFaults,
  faultAliases,
  procedures,
  faultProcedureLinks,
} from '../data/seeds/index'

loadEnv({ path: path.join(process.cwd(), '.env.local') })

function getEnv(name: string): string {
  const v = process.env[name]
  if (!v?.trim()) throw new Error(`Missing env: ${name}. Set it in .env.local or the shell.`)
  return v.trim()
}

function getSupabase(): SupabaseClient {
  const url = getEnv('NEXT_PUBLIC_SUPABASE_URL')
  const key = getEnv('SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key, { auth: { persistSession: false } })
}

function assertNonEmpty(value: unknown, label: string): void {
  if (value === null || value === undefined || (typeof value === 'string' && !value.trim())) {
    throw new Error(`Validation: ${label} must be non-empty`)
  }
}

/** Lightweight validation before any inserts. Throws on first failure. */
function validateSeeds(): void {
  const seenSlug = new Set<string>()
  for (const b of brands) {
    assertNonEmpty(b.slug, 'brand.slug')
    assertNonEmpty(b.name, 'brand.name')
    if (seenSlug.has(b.slug)) throw new Error(`Validation: duplicate brand slug "${b.slug}"`)
    seenSlug.add(b.slug)
  }

  const seenModuleCode = new Set<string>()
  for (const m of ecuModules) {
    assertNonEmpty(m.code, 'ecu_module.code')
    assertNonEmpty(m.name, 'ecu_module.name')
    assertNonEmpty(m.subsystem, 'ecu_module.subsystem')
    if (seenModuleCode.has(m.code)) throw new Error(`Validation: duplicate ecu_module code "${m.code}"`)
    seenModuleCode.add(m.code)
  }

  const faultCodes = new Set(canonicalFaults.map((f) => f.code))
  const seenFaultCode = new Set<string>()
  for (const f of canonicalFaults) {
    assertNonEmpty(f.code, 'canonical_fault.code')
    assertNonEmpty(f.title, 'canonical_fault.title')
    assertNonEmpty(f.subsystem, 'canonical_fault.subsystem')
    if (seenFaultCode.has(f.code)) throw new Error(`Validation: duplicate canonical_fault code "${f.code}"`)
    seenFaultCode.add(f.code)
  }

  const procedureCodes = new Set(procedures.map((p) => p.procedure_code))
  const seenProcedureCode = new Set<string>()
  for (const p of procedures) {
    assertNonEmpty(p.procedure_code, 'procedure.procedure_code')
    assertNonEmpty(p.title, 'procedure.title')
    if (seenProcedureCode.has(p.procedure_code)) throw new Error(`Validation: duplicate procedure_code "${p.procedure_code}"`)
    seenProcedureCode.add(p.procedure_code)
  }

  for (const a of faultAliases) {
    assertNonEmpty(a.alias_code, 'fault_alias.alias_code')
    assertNonEmpty(a.canonical_fault_code, 'fault_alias.canonical_fault_code')
    if (!faultCodes.has(a.canonical_fault_code)) {
      throw new Error(`Validation: fault_aliases reference unknown canonical_fault_code "${a.canonical_fault_code}"`)
    }
  }

  for (const l of faultProcedureLinks) {
    assertNonEmpty(l.fault_code, 'fault_procedure_link.fault_code')
    assertNonEmpty(l.procedure_code, 'fault_procedure_link.procedure_code')
    if (!faultCodes.has(l.fault_code)) {
      throw new Error(`Validation: fault_procedure_links reference unknown fault_code "${l.fault_code}"`)
    }
    if (!procedureCodes.has(l.procedure_code)) {
      throw new Error(`Validation: fault_procedure_links reference unknown procedure_code "${l.procedure_code}"`)
    }
  }
}

async function main() {
  console.log('Validating seed data...')
  validateSeeds()
  console.log('  validation passed')

  const supabase = getSupabase()

  console.log('Seeding brands...')
  const { data: brandRows, error: brandErr } = await supabase
    .from('brands')
    .insert(brands)
    .select('id, slug')
  if (brandErr) throw new Error(`brands: ${brandErr.message}`)
  const brandIdBySlug = new Map((brandRows ?? []).map((r) => [r.slug, r.id]))
  console.log(`  inserted ${brandRows?.length ?? 0} brands`)

  console.log('Seeding ecu_modules...')
  const { data: moduleRows, error: moduleErr } = await supabase
    .from('ecu_modules')
    .insert(ecuModules)
    .select('id, code')
  if (moduleErr) throw new Error(`ecu_modules: ${moduleErr.message}`)
  const moduleIdByCode = new Map((moduleRows ?? []).map((r) => [r.code, r.id]))
  console.log(`  inserted ${moduleRows?.length ?? 0} ecu_modules`)

  console.log('Seeding canonical_faults...')
  const faultRows = canonicalFaults.map((f) => {
    const { module_code, ...rest } = f
    const module_id = module_code ? moduleIdByCode.get(module_code) ?? null : null
    if (module_code && !module_id) {
      throw new Error(`canonical_faults: unknown module_code "${module_code}" (code: ${f.code}). Add it to ecu-modules.seed.ts.`)
    }
    return { ...rest, module_id }
  })
  const { data: insertedFaults, error: faultErr } = await supabase
    .from('canonical_faults')
    .insert(faultRows)
    .select('id, code')
  if (faultErr) throw new Error(`canonical_faults: ${faultErr.message}`)
  const faultIdByCode = new Map((insertedFaults ?? []).map((r) => [r.code, r.id]))
  console.log(`  inserted ${insertedFaults?.length ?? 0} canonical_faults`)

  console.log('Seeding fault_aliases...')
  const aliasRows = faultAliases.map((a) => ({
    alias_code: a.alias_code,
    alias_type: a.alias_type,
    canonical_fault_id: faultIdByCode.get(a.canonical_fault_code),
  }))
  const missingAlias = aliasRows.find((r) => !r.canonical_fault_id)
  if (missingAlias) {
    const ref = faultAliases.find((a) => faultIdByCode.get(a.canonical_fault_code) === undefined)
    throw new Error(`fault_aliases: unknown canonical_fault_code "${ref?.canonical_fault_code}". Must match a code in canonical-faults.seed.ts.`)
  }
  const { error: aliasErr } = await supabase.from('fault_aliases').insert(aliasRows)
  if (aliasErr) throw new Error(`fault_aliases: ${aliasErr.message}`)
  console.log(`  inserted ${aliasRows.length} fault_aliases`)

  console.log('Seeding procedures...')
  const procedureRows = procedures.map((p) => ({
    title: p.title,
    audience: p.audience,
    summary: p.summary ?? null,
    steps: Array.isArray(p.steps) ? p.steps : [],
    tools_required: Array.isArray(p.tools_required) ? p.tools_required : [],
    safety_notes: Array.isArray(p.safety_notes) ? p.safety_notes : [],
    stop_conditions: Array.isArray(p.stop_conditions) ? p.stop_conditions : [],
  }))
  const { data: procedureRowsOut, error: procErr } = await supabase
    .from('procedures')
    .insert(procedureRows)
    .select('id')
  if (procErr) throw new Error(`procedures: ${procErr.message}`)
  const procedureIdByCode = new Map<string, string>()
  procedureRowsOut?.forEach((row, i) => {
    const code = procedures[i]?.procedure_code
    if (code) procedureIdByCode.set(code, row.id)
  })
  console.log(`  inserted ${procedureRowsOut?.length ?? 0} procedures`)

  console.log('Seeding fault_procedure_links...')
  const linkRows = faultProcedureLinks.map((l) => ({
    fault_id: faultIdByCode.get(l.fault_code),
    procedure_id: procedureIdByCode.get(l.procedure_code),
    sort_order: l.sort_order ?? 0,
  }))
  const badFaultRef = linkRows.find((r) => !r.fault_id)
  if (badFaultRef) {
    const ref = faultProcedureLinks.find((l) => !faultIdByCode.get(l.fault_code))
    throw new Error(`fault_procedure_links: unknown fault_code "${ref?.fault_code}". Must match a code in canonical-faults.seed.ts.`)
  }
  const badProcRef = linkRows.find((r) => !r.procedure_id)
  if (badProcRef) {
    const ref = faultProcedureLinks.find((l) => !procedureIdByCode.get(l.procedure_code))
    throw new Error(`fault_procedure_links: unknown procedure_code "${ref?.procedure_code}". Must match procedures.seed.ts.`)
  }
  const linkRowsToInsert = linkRows.filter((r): r is { fault_id: string; procedure_id: string; sort_order: number } => Boolean(r.fault_id && r.procedure_id))
  const { error: linkErr } = await supabase.from('fault_procedure_links').insert(linkRowsToInsert)
  if (linkErr) throw new Error(`fault_procedure_links: ${linkErr.message}`)
  console.log(`  inserted ${linkRows.length} fault_procedure_links`)

  console.log('Done.')
  console.log(`  brands: ${brandRows?.length ?? 0}`)
  console.log(`  ecu_modules: ${moduleRows?.length ?? 0}`)
  console.log(`  canonical_faults: ${insertedFaults?.length ?? 0}`)
  console.log(`  fault_aliases: ${aliasRows.length}`)
  console.log(`  procedures: ${procedureRowsOut?.length ?? 0}`)
  console.log(`  fault_procedure_links: ${linkRows.length}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
