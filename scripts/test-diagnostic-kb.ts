/**
 * Local automated tests for the truck_diagnostic_kb integration.
 * Prevents regressions in the Volvo KB retrieval path.
 *
 * Requires: app running (e.g. npm run dev) and truck_diagnostic_kb populated (e.g. 7 Volvo rows).
 * Run: npx tsx scripts/test-diagnostic-kb.ts
 * Optional: BASE_URL=http://localhost:3001 npx tsx scripts/test-diagnostic-kb.ts
 */

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000'

const TESTS: Array<{
  id: string
  message: string
  expectMatchCount: number
  expectIsPartial: boolean
}> = [
  { id: 'volvo-spn-3557', message: 'Volvo SPN 3557', expectMatchCount: 1, expectIsPartial: true },
  { id: 'spn-168-volvo', message: 'SPN 168 Volvo', expectMatchCount: 1, expectIsPartial: true },
  { id: 'c0383-volvo', message: 'C0383 Volvo', expectMatchCount: 1, expectIsPartial: false },
]

const REPLY_MUST_CONTAIN = 'Diagnostic KB matches'

interface ChatResponse {
  reply?: string
  knowledgeContext?: {
    matchedDiagnosticKb?: Array<{ is_partial?: boolean; display_code?: string; canonical_fault_code?: string }>
  }
}

async function runOne(
  baseUrl: string,
  id: string,
  message: string,
  expectMatchCount: number,
  expectIsPartial: boolean
): Promise<{ passed: boolean; error?: string; details?: string }> {
  const url = `${baseUrl.replace(/\/$/, '')}/api/chat`
  const formData = new FormData()
  formData.set('message', message)

  let res: Response
  try {
    res = await fetch(url, { method: 'POST', body: formData })
  } catch (e) {
    return { passed: false, error: e instanceof Error ? e.message : String(e) }
  }

  if (!res.ok) {
    const text = await res.text()
    return { passed: false, error: `HTTP ${res.status}: ${text.slice(0, 200)}` }
  }

  const json = (await res.json()) as ChatResponse
  const reply = json.reply ?? ''
  const kb = json.knowledgeContext?.matchedDiagnosticKb ?? []

  const matchCountOk = kb.length >= expectMatchCount
  const replyHasBlock = reply.includes(REPLY_MUST_CONTAIN)
  const firstMatch = kb[0]
  const isPartialOk = !firstMatch
    ? expectMatchCount === 0
    : firstMatch.is_partial === expectIsPartial

  const passed = matchCountOk && replyHasBlock && isPartialOk
  const details = [
    `matchedDiagnosticKb.length=${kb.length} (expected >= ${expectMatchCount})`,
    `reply contains "${REPLY_MUST_CONTAIN}": ${replyHasBlock}`,
    `first match is_partial=${firstMatch?.is_partial} (expected ${expectIsPartial})`,
  ].join('; ')

  return { passed, details: passed ? undefined : details }
}

async function main() {
  console.log('TruckHelpNow truck_diagnostic_kb integration tests')
  console.log('BASE_URL:', BASE_URL)
  console.log('')

  let allPassed = true
  for (const t of TESTS) {
    process.stdout.write(`  [${t.id}] ... `)
    const result = await runOne(
      BASE_URL,
      t.id,
      t.message,
      t.expectMatchCount,
      t.expectIsPartial
    )
    if (result.passed) {
      console.log('PASS')
    } else {
      console.log('FAIL')
      if (result.error) console.log('    error:', result.error)
      if (result.details) console.log('    ', result.details)
      allPassed = false
    }
  }

  console.log('')
  if (allPassed) {
    console.log('All truck_diagnostic_kb tests passed.')
    process.exit(0)
  } else {
    console.log('Some tests failed.')
    process.exit(1)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
