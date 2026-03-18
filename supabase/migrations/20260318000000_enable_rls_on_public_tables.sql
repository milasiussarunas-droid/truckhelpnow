-- Harden public-schema tables exposed through PostgREST.
-- TruckHelpNow currently uses server-side service-role access only, so these
-- tables should default to deny-all for anon/authenticated roles unless we
-- intentionally add narrower policies later.

-- Remove permissive policies from the initial schema migration. Service-role
-- access bypasses RLS, so these policies are unnecessary and overly broad.
drop policy if exists "Service role full access on cases" on public.cases;
drop policy if exists "Service role full access on messages" on public.messages;

alter table if exists public.canonical_faults enable row level security;
alter table if exists public.cases enable row level security;
alter table if exists public.messages enable row level security;
alter table if exists public.handoff_requests enable row level security;
alter table if exists public.ecu_modules enable row level security;
alter table if exists public.procedures enable row level security;
alter table if exists public.fault_brand_overrides enable row level security;
alter table if exists public.fault_aliases enable row level security;
alter table if exists public.fault_component_links enable row level security;
alter table if exists public.components enable row level security;
alter table if exists public.fault_procedure_links enable row level security;
alter table if exists public.brands enable row level security;
alter table if exists public.source_documents enable row level security;
alter table if exists public.fault_symptom_links enable row level security;
alter table if exists public.symptoms enable row level security;
alter table if exists public.evidence_rules enable row level security;
alter table if exists public.truck_diagnostic_kb enable row level security;
