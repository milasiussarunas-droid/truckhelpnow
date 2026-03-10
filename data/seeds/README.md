# Diagnostic knowledge layer – seed data

Seed data for the truck diagnostic knowledge layer. Used by `scripts/seed-knowledge.ts` to populate Supabase after migrations.

## Format

- **TypeScript files** in `data/seeds/` export arrays of **seed row** objects.
- Rows use **human-readable reference keys** where a row references another table:
  - `module_code` → resolved to `ecu_modules.id` by loader
  - `canonical_fault_code` → resolved to `canonical_faults.id`
  - `fault_code` / `procedure_title` → resolved when inserting `fault_procedure_links`
- No `id`, `created_at`, or `updated_at` in seed rows; the database sets those.

## Loading into Supabase

1. Apply the diagnostic knowledge layer migration.
2. Set env (e.g. copy `.env.example` to `.env.local` and set `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`).
3. Run the loader:

   ```bash
   npx tsx scripts/seed-knowledge.ts
   ```

   Or add to `package.json`: `"seed": "tsx scripts/seed-knowledge.ts"` and run `npm run seed` (install `tsx` as devDependency if needed).

## Scaling to a larger knowledge base

- **More data**: Add more rows to the same `.ts` files or split by domain (e.g. `canonical_faults_engine.ts`, `canonical_faults_aftertreatment.ts`) and re-export from `index.ts`.
- **New tables**: Add a new seed file and seed row type, then extend the loader to insert in dependency order and build any new id maps.
- **External sources**: Keep seed files as the “curated core”; add separate ingestion scripts (e.g. in `scripts/ingest/`) that read CSV/JSON from OEM or third-party sources, normalize into the same row shapes, and either append to seed files or insert via the same Supabase client and maps.
- **Idempotency**: This loader does not deduplicate; re-running will insert duplicates. For production, add upsert logic (e.g. `onConflict` on `slug`/`code`/`title`) or clear tables first in a dedicated reset script.
