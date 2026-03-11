/**
 * One-off script to verify truck_diagnostic_kb table and retrieval.
 * Run: npx tsx scripts/check-diagnostic-kb.ts
 */
import { config as loadEnv } from 'dotenv'
import path from 'path'
import { getSupabase } from '../lib/supabase-server'

loadEnv({ path: path.join(process.cwd(), '.env.local') })
import { findDiagnosticKbMatches } from '../lib/diagnostics/retrieval'

async function main() {
  const supabase = getSupabase()

  console.log('1. Checking if truck_diagnostic_kb exists and has rows...')
  const { data: rows, error } = await supabase.from('truck_diagnostic_kb').select('*').limit(10)
  if (error) {
    console.error('Table query error:', error.message)
    process.exit(1)
  }
  console.log(`   Rows in table: ${rows?.length ?? 0}`)
  if (rows?.length) {
    console.log('   Sample columns:', Object.keys(rows[0] as object))
    console.log('   First row (sample):', JSON.stringify(rows[0], null, 2))
  }

  for (const test of [
    { rawCodes: ['SPN 3557'], brandSlug: 'volvo' },
    { rawCodes: ['SPN 168'], brandSlug: 'volvo' },
    { rawCodes: ['C0383'], brandSlug: 'volvo' },
    { rawCodes: ['C0376'], brandSlug: 'volvo' },
  ]) {
    console.log('\nfindDiagnosticKbMatches(', test, ')...')
    const matches = await findDiagnosticKbMatches(test)
    console.log(`   count: ${matches.length}`)
    matches.forEach((m, i) => console.log(`   [${i}]:`, m.display_code ?? m.canonical_fault_code, m.title ?? '(no title)', m.is_partial ? '(partial)' : ''))
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
