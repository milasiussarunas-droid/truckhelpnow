# TruckHelpNow

Truck repair and diagnostic help for drivers.

## Supabase Setup

1. Create a project at [supabase.com](https://supabase.com).

2. Copy `.env.example` to `.env.local` and add your credentials:
   - `NEXT_PUBLIC_SUPABASE_URL` — Project URL (Settings → API)
   - `SUPABASE_SERVICE_ROLE_KEY` — Service role key (Settings → API, under "Project API keys")

3. Run the migration in Supabase:
   - Open **SQL Editor** in your Supabase dashboard
   - Paste and run the contents of `supabase/migrations/20250228000000_initial_schema.sql`