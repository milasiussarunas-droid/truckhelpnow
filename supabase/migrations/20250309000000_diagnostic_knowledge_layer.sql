-- TruckHelpNow: diagnostic knowledge layer
-- Matches domain model in lib/diagnostics/types.ts
-- Does not modify existing tables (cases, messages).
-- Uses text + CHECK instead of enums for flexibility; ecu_modules naming; provenance FKs.

-- ─── Core reference tables (no FK dependencies) ─────────────────────────────

create table public.brands (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ecu_modules (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null,
  subsystem text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.components (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  subsystem text not null,
  oem_part_number text,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.symptoms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  subsystem text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─── Source documents (depends on brands) ───────────────────────────────────

create table public.source_documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  document_type text not null check (document_type in ('manual', 'tsb', 'bulletin', 'spec', 'other')),
  brand_id uuid references public.brands(id) on delete set null,
  url text,
  external_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─── Canonical faults (core table; depends on ecu_modules, source_documents) ─

create table public.canonical_faults (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  code_type text not null check (code_type in ('spn_fmi', 'p_code', 'obd2', 'proprietary', 'other')),
  spn integer,
  fmi integer,
  subsystem text not null,
  title text not null,
  description text,
  severity text not null check (severity in ('low', 'medium', 'high', 'critical')),
  driveability text not null check (driveability in ('normal', 'derate', 'limp_home', 'no_start', 'stop_safely', 'unknown')),
  module_id uuid references public.ecu_modules(id) on delete set null,
  source_document_id uuid references public.source_documents(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─── Procedures (depends on source_documents) ───────────────────────────────────

create table public.procedures (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  audience text not null check (audience in ('driver', 'technician', 'shop')),
  summary text,
  steps jsonb not null default '[]'::jsonb,
  tools_required jsonb not null default '[]'::jsonb,
  safety_notes jsonb not null default '[]'::jsonb,
  stop_conditions jsonb not null default '[]'::jsonb,
  source_document_id uuid references public.source_documents(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─── Fault aliases (raw/OEM display codes → canonical fault) ──────────────────

create table public.fault_aliases (
  id uuid primary key default gen_random_uuid(),
  canonical_fault_id uuid not null references public.canonical_faults(id) on delete cascade,
  alias_code text not null,
  alias_type text not null check (alias_type in ('spn_fmi', 'p_code', 'obd2', 'proprietary', 'other')),
  source_document_id uuid references public.source_documents(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ─── Brand-specific fault overrides ─────────────────────────────────────────

create table public.fault_brand_overrides (
  id uuid primary key default gen_random_uuid(),
  canonical_fault_id uuid not null references public.canonical_faults(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  override_title text,
  override_description text,
  override_severity text check (override_severity is null or override_severity in ('low', 'medium', 'high', 'critical')),
  override_driveability text check (override_driveability is null or override_driveability in ('normal', 'derate', 'limp_home', 'no_start', 'stop_safely', 'unknown')),
  source_document_id uuid references public.source_documents(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (canonical_fault_id, brand_id)
);

-- ─── Link tables (fault ↔ component, procedure, symptom) ─────────────────────

create table public.fault_component_links (
  id uuid primary key default gen_random_uuid(),
  fault_id uuid not null references public.canonical_faults(id) on delete cascade,
  component_id uuid not null references public.components(id) on delete cascade,
  role text not null check (role in ('affected', 'related', 'cause', 'sensor')),
  created_at timestamptz not null default now(),
  unique (fault_id, component_id, role)
);

create table public.fault_procedure_links (
  id uuid primary key default gen_random_uuid(),
  fault_id uuid not null references public.canonical_faults(id) on delete cascade,
  procedure_id uuid not null references public.procedures(id) on delete cascade,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (fault_id, procedure_id)
);

create table public.fault_symptom_links (
  id uuid primary key default gen_random_uuid(),
  fault_id uuid not null references public.canonical_faults(id) on delete cascade,
  symptom_id uuid not null references public.symptoms(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (fault_id, symptom_id)
);

-- ─── Evidence rules (JSONB-based conditions for RAG/retrieval) ──────────────

create table public.evidence_rules (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  condition jsonb not null default '{}',
  confidence text not null check (confidence in ('low', 'medium', 'high')),
  status text not null check (status in ('active', 'draft', 'deprecated')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─── Indexes for lookup-heavy fields ───────────────────────────────────────

create index idx_brands_slug on public.brands(slug);
create index idx_brands_name on public.brands(name);

create index idx_ecu_modules_code on public.ecu_modules(code);
create index idx_ecu_modules_subsystem on public.ecu_modules(subsystem);

create index idx_canonical_faults_code on public.canonical_faults(code);
create index idx_canonical_faults_code_type on public.canonical_faults(code_type);
create index idx_canonical_faults_spn_fmi on public.canonical_faults(spn, fmi) where spn is not null and fmi is not null;
create index idx_canonical_faults_subsystem on public.canonical_faults(subsystem);
create index idx_canonical_faults_module_id on public.canonical_faults(module_id);
create index idx_canonical_faults_source_document_id on public.canonical_faults(source_document_id);

create index idx_fault_aliases_alias_code on public.fault_aliases(alias_code);
create index idx_fault_aliases_canonical_fault_id on public.fault_aliases(canonical_fault_id);
create index idx_fault_aliases_source_document_id on public.fault_aliases(source_document_id);

create index idx_fault_brand_overrides_canonical_fault_id on public.fault_brand_overrides(canonical_fault_id);
create index idx_fault_brand_overrides_brand_id on public.fault_brand_overrides(brand_id);
create index idx_fault_brand_overrides_source_document_id on public.fault_brand_overrides(source_document_id);

create index idx_components_subsystem on public.components(subsystem);

create index idx_fault_component_links_fault_id on public.fault_component_links(fault_id);
create index idx_fault_component_links_component_id on public.fault_component_links(component_id);

create index idx_procedures_audience on public.procedures(audience);
create index idx_procedures_source_document_id on public.procedures(source_document_id);

create index idx_fault_procedure_links_fault_id on public.fault_procedure_links(fault_id);
create index idx_fault_procedure_links_procedure_id on public.fault_procedure_links(procedure_id);

create index idx_symptoms_subsystem on public.symptoms(subsystem);

create index idx_fault_symptom_links_fault_id on public.fault_symptom_links(fault_id);
create index idx_fault_symptom_links_symptom_id on public.fault_symptom_links(symptom_id);

create index idx_source_documents_brand_id on public.source_documents(brand_id);
create index idx_source_documents_document_type on public.source_documents(document_type);

create index idx_evidence_rules_status on public.evidence_rules(status);
create index idx_evidence_rules_condition on public.evidence_rules using gin(condition);

-- ─── Trigger: updated_at ───────────────────────────────────────────────────

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

create trigger set_brands_updated_at
  before update on public.brands
  for each row execute function public.set_updated_at();
create trigger set_ecu_modules_updated_at
  before update on public.ecu_modules
  for each row execute function public.set_updated_at();
create trigger set_components_updated_at
  before update on public.components
  for each row execute function public.set_updated_at();
create trigger set_symptoms_updated_at
  before update on public.symptoms
  for each row execute function public.set_updated_at();
create trigger set_source_documents_updated_at
  before update on public.source_documents
  for each row execute function public.set_updated_at();
create trigger set_canonical_faults_updated_at
  before update on public.canonical_faults
  for each row execute function public.set_updated_at();
create trigger set_procedures_updated_at
  before update on public.procedures
  for each row execute function public.set_updated_at();
create trigger set_fault_brand_overrides_updated_at
  before update on public.fault_brand_overrides
  for each row execute function public.set_updated_at();
create trigger set_evidence_rules_updated_at
  before update on public.evidence_rules
  for each row execute function public.set_updated_at();
