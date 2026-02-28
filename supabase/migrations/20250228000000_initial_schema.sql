-- TruckHelpNow: cases and messages tables

create table if not exists public.cases (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz default now()
);

create index if not exists messages_case_id_idx on public.messages(case_id);

-- Enable RLS (optional; service role bypasses it)
alter table public.cases enable row level security;
alter table public.messages enable row level security;

-- Allow service role full access (default)
create policy "Service role full access on cases"
  on public.cases for all
  using (true)
  with check (true);

create policy "Service role full access on messages"
  on public.messages for all
  using (true)
  with check (true);
