/**
 * Lightweight evaluation runner for the TruckHelpNow diagnostic system.
 * Loads test cases, POSTs each to the chat API, captures response, compares to expected, prints report.
 * Supports text-only, image-only, and image+message cases via optional input.imagePath.
 *
 * Usage: npx tsx scripts/run-diagnostic-eval.ts [path-to-test-cases.json]
 * Default test file: lib/diagnostics/evaluation/test-cases.example.json
 * Set BASE_URL (default http://localhost:3000) if the app runs elsewhere.
 */

import * as fs from 'fs'
import * as path from 'path'
import type {
  DiagnosticTestCase,
  DiagnosticTestCaseExpected,
  DiagnosticTestRunOutput,
} from '../lib/diagnostics/evaluation/test-case-schema'

const DEFAULT_TEST_FILE = path.join(
  process.cwd(),
  'lib/diagnostics/evaluation/test-cases.example.json'
)
const DEFAULT_BASE_URL = 'http://localhost:3000'

const ALLOWED_IMAGE_EXTENSIONS: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
}

const HONESTY_NOTE_PHRASE = 'evidence and knowledge-base signals are not fully aligned'
const UNRESOLVED_HINTS = [
  'unresolved',
  'not in kb',
  'not in knowledge',
  'not found',
  'no match',
  'unknown code',
  'missing information',
  'gaps',
]

function loadTestCases(filePath: string): DiagnosticTestCase[] {
  const raw = fs.readFileSync(filePath, 'utf-8')
  const data = JSON.parse(raw)
  if (!Array.isArray(data)) throw new Error('Test case file must be a JSON array')
  return data as DiagnosticTestCase[]
}

function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase()
  return ALLOWED_IMAGE_EXTENSIONS[ext] ?? 'image/png'
}

async function runCase(
  baseUrl: string,
  case_: DiagnosticTestCase
): Promise<{ output: DiagnosticTestRunOutput; error?: string }> {
  const url = `${baseUrl.replace(/\/$/, '')}/api/chat`
  const formData = new FormData()
  formData.set('message', case_.input.message ?? '')

  if (case_.input.imagePath) {
    const resolvedPath = path.isAbsolute(case_.input.imagePath)
      ? case_.input.imagePath
      : path.join(process.cwd(), case_.input.imagePath)
    if (!fs.existsSync(resolvedPath)) {
      return {
        output: {
          reply: '',
          diagnosticConsistency: { isConsistent: true, warnings: [], severity: 'low' },
        },
        error: `Image file not found: ${resolvedPath}`,
      }
    }
    const buffer = fs.readFileSync(resolvedPath)
    const mime = getMimeType(resolvedPath)
    const blob = new Blob([buffer], { type: mime })
    const filename = path.basename(resolvedPath)
    formData.set('image', blob, filename)
  }

  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      body: formData,
    })
  } catch (e) {
    return {
      output: {
        reply: '',
        diagnosticConsistency: { isConsistent: true, warnings: [], severity: 'low' },
      },
      error: e instanceof Error ? e.message : String(e),
    }
  }

  if (!res.ok) {
    const text = await res.text()
    return {
      output: {
        reply: '',
        diagnosticConsistency: { isConsistent: true, warnings: [], severity: 'low' },
      },
      error: `HTTP ${res.status}: ${text.slice(0, 200)}`,
    }
  }

  const json = (await res.json()) as {
    reply?: string
    structured?: {
      primary_systems_involved?: string[]
      overall_confidence?: string
      safety_level?: string
      missing_information?: string[]
    }
    knowledgeContext?: {
      rankedCanonicalFaults?: Array<{
        fault: { code: string; title: string }
        score: number
        confidence: string
        reasons: string[]
      }>
      unresolvedCodes?: string[]
    }
    usedTwoPassFlow?: boolean
    diagnosticConsistency?: {
      isConsistent: boolean
      warnings: string[]
      severity: 'low' | 'medium'
    }
  }

  const reply = json.reply ?? ''
  const ranked = json.knowledgeContext?.rankedCanonicalFaults ?? []
  const consistency = json.diagnosticConsistency ?? {
    isConsistent: true,
    warnings: [] as string[],
    severity: 'low' as const,
  }
  const replyLower = reply.toLowerCase()

  const hasHonestyNote =
    !consistency.isConsistent && replyLower.includes(HONESTY_NOTE_PHRASE.toLowerCase())

  const output: DiagnosticTestRunOutput = {
    reply,
    usedTwoPassFlow: json.usedTwoPassFlow,
    rankedCanonicalFaults: ranked.map((r) => ({
      code: r.fault?.code ?? '',
      title: r.fault?.title ?? '',
      score: r.score,
      confidence: r.confidence ?? '',
      reasons: r.reasons ?? [],
    })),
    unresolvedCodes: json.knowledgeContext?.unresolvedCodes ?? [],
    diagnosticConsistency: {
      isConsistent: consistency.isConsistent,
      warnings: consistency.warnings ?? [],
      severity: consistency.severity ?? 'low',
    },
    primarySystemsInvolved: json.structured?.primary_systems_involved ?? [],
    overallConfidence: json.structured?.overall_confidence,
    safetyLevel: json.structured?.safety_level,
    hasHonestyNote,
  }

  return { output }
}

function compare(
  expected: DiagnosticTestCaseExpected | undefined,
  output: DiagnosticTestRunOutput
): { passed: string[]; failed: string[] } {
  const passed: string[] = []
  const failed: string[] = []

  if (!expected) return { passed, failed }

  if (expected.primarySubsystems && expected.primarySubsystems.length > 0) {
    const primary = (output.primarySystemsInvolved ?? []).map((s) => s.toLowerCase())
    const missing = expected.primarySubsystems.filter(
      (s) => !primary.some((p) => p.includes(s.toLowerCase()))
    )
    if (missing.length === 0) passed.push('primarySubsystems')
    else failed.push(`primarySubsystems (missing: ${missing.join(', ')})`)
  }

  if (expected.replyContainsPhrases && expected.replyContainsPhrases.length > 0) {
    const replyLower = output.reply.toLowerCase()
    const missing = expected.replyContainsPhrases.filter(
      (p) => !replyLower.includes(p.toLowerCase())
    )
    if (missing.length === 0) passed.push('replyContainsPhrases')
    else failed.push(`replyContainsPhrases (missing: ${missing.join(', ')})`)
  }

  if (expected.acknowledgesUnresolved === true) {
    const hasUnresolved = (output.unresolvedCodes ?? []).length > 0
    const replyLower = output.reply.toLowerCase()
    const acknowledged = UNRESOLVED_HINTS.some((h) => replyLower.includes(h))
    if (hasUnresolved && acknowledged) passed.push('acknowledgesUnresolved')
    else if (hasUnresolved && !acknowledged) failed.push('acknowledgesUnresolved (reply does not acknowledge gaps)')
    else if (!hasUnresolved) passed.push('acknowledgesUnresolved (no unresolved codes)')
  }

  if (expected.expectHonestyNoteWhenInconsistent === true) {
    if (output.diagnosticConsistency.isConsistent) {
      passed.push('expectHonestyNoteWhenInconsistent (N/A: consistent)')
    } else if (output.hasHonestyNote) {
      passed.push('expectHonestyNoteWhenInconsistent')
    } else {
      failed.push('expectHonestyNoteWhenInconsistent (inconsistent but no honesty note)')
    }
  }

  if (expected.topRankedFaultCodes && expected.topRankedFaultCodes.length > 0) {
    const codes = (output.rankedCanonicalFaults ?? []).map((r) => r.code)
    const found = expected.topRankedFaultCodes.some((c) =>
      codes.some((r) => r.includes(c) || c.includes(r))
    )
    if (found) passed.push('topRankedFaultCodes')
    else failed.push(`topRankedFaultCodes (expected one of: ${expected.topRankedFaultCodes.join(', ')})`)
  }

  if (expected.safetyLevel) {
    const actual = output.safetyLevel
    if (actual === expected.safetyLevel) passed.push('safetyLevel')
    else failed.push(`safetyLevel (expected: ${expected.safetyLevel}, got: ${actual ?? '—'})`)
  }

  if (expected.expectTwoPassFlow === true) {
    if (output.usedTwoPassFlow === true) passed.push('expectTwoPassFlow')
    else failed.push(`expectTwoPassFlow (expected two-pass flow, got: ${output.usedTwoPassFlow ?? false})`)
  }

  return { passed, failed }
}

async function main() {
  const testFile = process.argv[2] ?? DEFAULT_TEST_FILE
  const baseUrl = process.env.BASE_URL ?? DEFAULT_BASE_URL

  console.log('TruckHelpNow diagnostic evaluation')
  console.log('====================================')
  console.log('Test file:', testFile)
  console.log('Base URL:', baseUrl)
  console.log('')

  let cases: DiagnosticTestCase[]
  try {
    cases = loadTestCases(testFile)
  } catch (e) {
    console.error('Failed to load test cases:', e instanceof Error ? e.message : e)
    process.exit(1)
  }

  if (cases.length === 0) {
    console.log('No test cases found.')
    process.exit(0)
  }

  const results: Array<{
    case_: DiagnosticTestCase
    output: DiagnosticTestRunOutput
    error?: string
    passed: string[]
    failed: string[]
  }> = []

  for (let i = 0; i < cases.length; i++) {
    const case_ = cases[i]
    process.stderr.write(`  [${i + 1}/${cases.length}] ${case_.id} ... `)
    const { output, error } = await runCase(baseUrl, case_)
    const { passed, failed } = compare(case_.expected, output)
    results.push({ case_, output, error, passed, failed })
    process.stderr.write(error ? 'error\n' : 'done\n')
  }

  console.log('')
  console.log('Per-case results')
  console.log('----------------')

  let totalPassed = 0
  let totalFailed = 0
  let totalErrors = 0
  let totalConsistent = 0
  let totalWithHonestyNote = 0

  for (const r of results) {
    console.log(`\n${r.case_.id}`)
    if (r.error) {
      console.log('  ERROR:', r.error)
      totalErrors++
    } else {
      console.log('  reply length:', r.output.reply.length)
      console.log('  usedTwoPassFlow:', r.output.usedTwoPassFlow ?? false)
      console.log('  rankedCanonicalFaults:', (r.output.rankedCanonicalFaults ?? []).length)
      console.log('  unresolvedCodes:', (r.output.unresolvedCodes ?? []).length)
      console.log('  diagnosticConsistency:', r.output.diagnosticConsistency.isConsistent ? 'consistent' : 'inconsistent')
      console.log('  primarySystemsInvolved:', (r.output.primarySystemsInvolved ?? []).join(', ') || '—')
      console.log('  overallConfidence:', r.output.overallConfidence ?? '—')
      console.log('  hasHonestyNote:', r.output.hasHonestyNote ?? false)

      if (!r.output.diagnosticConsistency.isConsistent) totalWithHonestyNote += r.output.hasHonestyNote ? 1 : 0
      if (r.output.diagnosticConsistency.isConsistent) totalConsistent++

      if (r.passed.length) console.log('  passed:', r.passed.join(', '))
      if (r.failed.length) console.log('  failed:', r.failed.join(', '))
      totalPassed += r.passed.length
      totalFailed += r.failed.length
    }
  }

  console.log('')
  console.log('Totals')
  console.log('-------')
  console.log('  cases:', results.length)
  console.log('  errors:', totalErrors)
  console.log('  expectation checks passed:', totalPassed)
  console.log('  expectation checks failed:', totalFailed)
  console.log('  responses consistent (diagnosticConsistency):', totalConsistent, '/', Math.max(0, results.length - totalErrors))
  console.log('  honesty note present when inconsistent:', totalWithHonestyNote)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
