/**
 * Server-side retrieval for the truck diagnostic knowledge layer.
 * Use from API routes or server code only. Uses getSupabase() from lib/supabase-server.
 */

import { getSupabase } from '@/lib/supabase-server'
import type {
  Brand,
  CanonicalFault,
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
