-- truck_diagnostic_kb: additional diagnostic knowledge source (e.g. Volvo rows).
-- Chat retrieval uses this alongside canonical_faults/fault_aliases.
-- Columns: display_code, canonical_fault_code, brand_slug, spn, fmi, title, description, is_partial, provenance.

create table if not exists public.truck_diagnostic_kb (
  id uuid primary key default gen_random_uuid(),
  display_code text,
  canonical_fault_code text,
  brand_slug text,
  spn integer,
  fmi integer,
  title text,
  description text,
  is_partial boolean default false,
  provenance text,
  created_at timestamptz not null default now()
);

create index if not exists idx_truck_diagnostic_kb_display_code
  on public.truck_diagnostic_kb(display_code) where display_code is not null;
create index if not exists idx_truck_diagnostic_kb_canonical_fault_code
  on public.truck_diagnostic_kb(canonical_fault_code) where canonical_fault_code is not null;
create index if not exists idx_truck_diagnostic_kb_brand_slug
  on public.truck_diagnostic_kb(brand_slug) where brand_slug is not null;
create index if not exists idx_truck_diagnostic_kb_spn_fmi
  on public.truck_diagnostic_kb(spn, fmi) where spn is not null and fmi is not null;
