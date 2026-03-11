/**
 * Server-side retrieval for the truck diagnostic knowledge layer.
 * Use from API routes or server code only. Uses getSupabase() from lib/supabase-server.
 */

import { getSupabase } from '@/lib/supabase-server'
import type {
  Brand,
  CanonicalFault,
  DiagnosticKbRow,
  FaultAlias,
  FaultBrandOverride,
  ModuleDefinition,
  Procedure,
} from '@/lib/diagnostics/types'

// ─── Brands ─────────────────────────────────────────────────────────────────

/**
 * Find a brand by exact slug or case-insensitive name match.
 * Returns the first matching brand or null.
 */
export async function getBrandByNameOrSlug(input: string): Promise<Brand | null> {
  const trimmed = input?.trim()
  if (!trimmed) return null
  const supabase = getSupabase()
  const { data: bySlug } = await supabase
    .from('brands')
    .select('*')
    .eq('slug', trimmed)
    .maybeSingle()
  if (bySlug) return bySlug as Brand
  const { data: byName, error } = await supabase
    .from('brands')
    .select('*')
    .ilike('name', trimmed)
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(`getBrandByNameOrSlug: ${error.message}`)
  return byName as Brand | null
}

// ─── ECU modules ───────────────────────────────────────────────────────────

/**
 * Get a single ECU module by its unique code (e.g. ECM, ACM, TCM).
 */
export async function getEcuModuleByCode(code: string): Promise<ModuleDefinition | null> {
  const trimmed = code?.trim()
  if (!trimmed) return null
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('ecu_modules')
    .select('*')
    .eq('code', trimmed)
    .maybeSingle()
  if (error) throw new Error(`getEcuModuleByCode: ${error.message}`)
  return data as ModuleDefinition | null
}

// ─── Canonical faults ──────────────────────────────────────────────────────

/**
 * Get a canonical fault by its exact code string (e.g. "SPN 4364 FMI 18").
 */
export async function getCanonicalFaultByCode(code: string): Promise<CanonicalFault | null> {
  const trimmed = code?.trim()
  if (!trimmed) return null
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('canonical_faults')
    .select('*')
    .eq('code', trimmed)
    .maybeSingle()
  if (error) throw new Error(`getCanonicalFaultByCode: ${error.message}`)
  return data as CanonicalFault | null
}

/**
 * Get a canonical fault by its UUID (e.g. when resolving from a fault alias).
 */
export async function getCanonicalFaultById(id: string): Promise<CanonicalFault | null> {
  const trimmed = id?.trim()
  if (!trimmed) return null
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('canonical_faults')
    .select('*')
    .eq('id', trimmed)
    .maybeSingle()
  if (error) throw new Error(`getCanonicalFaultById: ${error.message}`)
  return data as CanonicalFault | null
}

/**
 * Get a canonical fault by SPN and FMI (J1939 style).
 * Returns the first match if multiple exist; null if none.
 */
export async function getCanonicalFaultBySpnFmi(
  spn: number,
  fmi: number
): Promise<CanonicalFault | null> {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('canonical_faults')
    .select('*')
    .eq('spn', spn)
    .eq('fmi', fmi)
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(`getCanonicalFaultBySpnFmi: ${error.message}`)
  return data as CanonicalFault | null
}

// ─── Fault aliases ─────────────────────────────────────────────────────────

/**
 * Find all fault alias rows that match the raw/display code (e.g. "P20EE", "4364/18").
 * Returns an array of aliases; each has canonical_fault_id to resolve to a canonical fault.
 */
export async function findFaultAliasesByRawCode(aliasCode: string): Promise<FaultAlias[]> {
  const trimmed = aliasCode?.trim()
  if (!trimmed) return []
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('fault_aliases')
    .select('*')
    .eq('alias_code', trimmed)
  if (error) throw new Error(`findFaultAliasesByRawCode: ${error.message}`)
  return (data ?? []) as FaultAlias[]
}

// ─── Procedures for a fault ─────────────────────────────────────────────────

/**
 * Get procedures linked to a canonical fault, ordered by sort_order.
 * Returns procedure rows only (no link metadata).
 */
export async function getProceduresForCanonicalFault(faultId: string): Promise<Procedure[]> {
  const trimmed = faultId?.trim()
  if (!trimmed) return []
  const supabase = getSupabase()
  const { data: links, error: linkError } = await supabase
    .from('fault_procedure_links')
    .select('procedure_id, sort_order')
    .eq('fault_id', trimmed)
    .order('sort_order', { ascending: true })
  if (linkError) throw new Error(`getProceduresForCanonicalFault: ${linkError.message}`)
  if (!links?.length) return []
  const procedureIds = links.map((l) => l.procedure_id)
  const { data: procedures, error: procError } = await supabase
    .from('procedures')
    .select('*')
    .in('id', procedureIds)
  if (procError) throw new Error(`getProceduresForCanonicalFault: ${procError.message}`)
  const byId = new Map((procedures ?? []).map((p) => [p.id, p]))
  return links.map((l) => byId.get(l.procedure_id)).filter(Boolean) as Procedure[]
}

// ─── Brand override for a fault ─────────────────────────────────────────────

/**
 * Get the brand-specific override for a canonical fault, if any.
 */
export async function getBrandOverrideForFault(
  faultId: string,
  brandId: string
): Promise<FaultBrandOverride | null> {
  const fId = faultId?.trim()
  const bId = brandId?.trim()
  if (!fId || !bId) return null
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('fault_brand_overrides')
    .select('*')
    .eq('canonical_fault_id', fId)
    .eq('brand_id', bId)
    .maybeSingle()
  if (error) throw new Error(`getBrandOverrideForFault: ${error.message}`)
  return data as FaultBrandOverride | null
}

// ─── truck_diagnostic_kb (additional KB source) ─────────────────────────────

/**
 * Find rows in truck_diagnostic_kb matching raw/display codes, canonical code, or SPN/FMI.
 * Optional brand_slug filters to brand-specific rows (e.g. Volvo).
 * Preserves is_partial and provenance; used as additional context alongside canonical_faults.
 */
export async function findDiagnosticKbMatches(opts: {
  rawCodes: string[]
  brandSlug?: string | null
  spnFmiCandidates?: { spn: number; fmi: number }[]
}): Promise<DiagnosticKbRow[]> {
  const { rawCodes, brandSlug, spnFmiCandidates } = opts
  const codes = rawCodes.filter((c) => c?.trim())
  const supabase = getSupabase()
  const seen = new Map<string, DiagnosticKbRow>()

  const normalizeRow = (row: Record<string, unknown>): DiagnosticKbRow => ({
    id: String(row.id ?? ''),
    display_code: (row.display_code ?? row.code ?? row.raw_code) != null
      ? String(row.display_code ?? row.code ?? row.raw_code)
      : null,
    canonical_fault_code: row.canonical_fault_code != null ? String(row.canonical_fault_code) : null,
    brand_slug: (row.brand_slug ?? row.brand) != null ? String(row.brand_slug ?? row.brand) : null,
    spn: row.spn != null ? Number(row.spn) : null,
    fmi: row.fmi != null ? Number(row.fmi) : null,
    title: row.title != null ? String(row.title) : null,
    description: row.description != null ? String(row.description) : null,
    is_partial: row.is_partial != null ? Boolean(row.is_partial) : null,
    provenance:
      row.provenance != null
        ? typeof row.provenance === 'string'
          ? row.provenance
          : JSON.stringify(row.provenance)
        : null,
  })

  const brandFilter = brandSlug?.trim() ?? null
  // Prefer 'brand' column (actual table); fallback to 'brand_slug' for migration schema
  const brandCol = 'brand'

  if (codes.length > 0) {
    for (const col of ['display_code', 'canonical_fault_code', 'code', 'raw_code'] as const) {
      let q = supabase.from('truck_diagnostic_kb').select('*').in(col, codes)
      if (brandFilter) q = q.eq(brandCol, brandFilter)
      const { data, error } = await q
      if (error) continue
      for (const row of data ?? []) {
        const r = normalizeRow(row as Record<string, unknown>)
        if (r.id && !seen.has(r.id)) seen.set(r.id, r)
      }
    }
  }

  if (spnFmiCandidates?.length) {
    for (const { spn, fmi } of spnFmiCandidates) {
      let q = supabase
        .from('truck_diagnostic_kb')
        .select('*')
        .eq('spn', spn)
        .eq('fmi', fmi)
      if (brandFilter) q = q.eq(brandCol, brandFilter)
      const { data, error } = await q
      if (error) throw new Error(`findDiagnosticKbMatches(spn/fmi): ${error.message}`)
      for (const row of data ?? []) {
        const r = normalizeRow(row as Record<string, unknown>)
        if (r.id && !seen.has(r.id)) seen.set(r.id, r)
      }
    }
  }

  // SPN-only rows (spn set, fmi null): match rawCodes like "SPN 3557" to rows with that spn and no fmi
  const spnOnlyRegex = /^SPN\s*(\d+)$/i
  for (const raw of codes) {
    const match = raw.match(spnOnlyRegex)
    if (!match) continue
    const spn = parseInt(match[1], 10)
    if (Number.isNaN(spn)) continue
    let q = supabase
      .from('truck_diagnostic_kb')
      .select('*')
      .eq('spn', spn)
      .is('fmi', null)
    if (brandFilter) q = q.eq(brandCol, brandFilter)
    const { data, error } = await q
    if (error) continue
    for (const row of data ?? []) {
      const r = normalizeRow(row as Record<string, unknown>)
      if (r.id && !seen.has(r.id)) seen.set(r.id, r)
    }
  }

  return Array.from(seen.values())
}
