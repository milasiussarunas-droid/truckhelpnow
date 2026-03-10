import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { checkDiagnosticConsistency } from '@/lib/diagnostics/consistency-check'
import { extractTruckEvidence } from '@/lib/diagnostics/evidence-extraction'
import { resolveTruckFaultContext } from '@/lib/diagnostics/knowledge-service'

const ALLOWED_IMAGE_TYPES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
] as const
const MAX_IMAGE_SIZE_BYTES = 8 * 1024 * 1024 // 8 MB

const DETECTED_CODE_ITEM_SCHEMA = {
  type: 'object' as const,
  properties: {
    raw_code: { type: 'string' },
    normalized_code: { type: 'string' },
    code_type: { type: 'string' },
    confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
    interpretation: { type: 'string' },
  },
  required: ['raw_code', 'normalized_code', 'code_type', 'confidence', 'interpretation'],
  additionalProperties: false,
}

/** Pass 1: extraction-only schema (no diagnosis fields). */
const EXTRACTION_RESPONSE_SCHEMA = {
  type: 'object' as const,
  properties: {
    image_quality: { type: 'string' },
    visible_text: { type: 'array', items: { type: 'string' } },
    uncertain_text: { type: 'array', items: { type: 'string' } },
    detected_codes: { type: 'array', items: DETECTED_CODE_ITEM_SCHEMA },
    warnings_detected: { type: 'array', items: { type: 'string' } },
    fault_timestamps: { type: 'array', items: { type: 'string' } },
  },
  required: [
    'image_quality',
    'visible_text',
    'uncertain_text',
    'detected_codes',
    'warnings_detected',
    'fault_timestamps',
  ],
  additionalProperties: false,
} as const

const DIAGNOSTIC_RESPONSE_SCHEMA = {
  type: 'object' as const,
  properties: {
    image_quality: { type: 'string' },
    visible_text: { type: 'array', items: { type: 'string' } },
    uncertain_text: { type: 'array', items: { type: 'string' } },
    detected_codes: { type: 'array', items: DETECTED_CODE_ITEM_SCHEMA },
    warnings_detected: { type: 'array', items: { type: 'string' } },
    fault_timestamps: { type: 'array', items: { type: 'string' } },
    fault_pattern: {
      type: 'string',
      enum: ['intermittent', 'recurring', 'persistent', 'unclear'],
    },
    primary_systems_involved: { type: 'array', items: { type: 'string' } },
    most_likely_problem: { type: 'string' },
    possible_causes: { type: 'array', items: { type: 'string' } },
    recommended_checks_immediate: { type: 'array', items: { type: 'string' } },
    recommended_checks_shop_level: { type: 'array', items: { type: 'string' } },
    driver_guidance: { type: 'string' },
    mechanic_guidance: { type: 'string' },
    missing_information: { type: 'array', items: { type: 'string' } },
    can_driver_continue: { type: 'string', enum: ['yes', 'maybe', 'no'] },
    safety_level: { type: 'string', enum: ['low', 'medium', 'high'] },
    safety_message: { type: 'string' },
    overall_confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
  },
  required: [
    'image_quality',
    'visible_text',
    'uncertain_text',
    'detected_codes',
    'warnings_detected',
    'fault_timestamps',
    'fault_pattern',
    'primary_systems_involved',
    'most_likely_problem',
    'possible_causes',
    'recommended_checks_immediate',
    'recommended_checks_shop_level',
    'driver_guidance',
    'mechanic_guidance',
    'missing_information',
    'can_driver_continue',
    'safety_level',
    'safety_message',
    'overall_confidence',
  ],
  additionalProperties: false,
}

export type DetectedCodeItem = {
  raw_code: string
  normalized_code: string
  code_type: string
  confidence: 'low' | 'medium' | 'high'
  interpretation: string
}

export type DiagnosticResponse = {
  image_quality: string
  visible_text: string[]
  uncertain_text: string[]
  detected_codes: DetectedCodeItem[]
  warnings_detected: string[]
  fault_timestamps: string[]
  fault_pattern: 'intermittent' | 'recurring' | 'persistent' | 'unclear'
  primary_systems_involved: string[]
  most_likely_problem: string
  possible_causes: string[]
  recommended_checks_immediate: string[]
  recommended_checks_shop_level: string[]
  driver_guidance: string
  mechanic_guidance: string
  missing_information: string[]
  can_driver_continue: 'yes' | 'maybe' | 'no'
  safety_level: 'low' | 'medium' | 'high'
  safety_message: string
  overall_confidence: 'low' | 'medium' | 'high'
}

/** Pass 1 extraction result (no diagnosis fields). */
export type ExtractionResult = {
  image_quality: string
  visible_text: string[]
  uncertain_text: string[]
  detected_codes: DetectedCodeItem[]
  warnings_detected: string[]
  fault_timestamps: string[]
}

const EXTRACTION_TOP_LEVEL_KEYS = [
  'image_quality',
  'visible_text',
  'uncertain_text',
  'detected_codes',
  'warnings_detected',
  'fault_timestamps',
] as const

const systemPrompt = `You are a truck diagnostic assistant for TruckHelpNow. Help drivers with:
- Truck year, make, model, and engine type
- Symptoms and fault codes (SPN/FMI when available)
- Drivers can also upload photos of their dashboard (warnings, lights, gauges) or scan tool / DTC reader screens for analysis.
Keep answers concise and practical. Always recommend professional help for brakes, steering, overheating, fuel leaks, or fire risk. This is informational guidance only.
Avoid generic fallback: tie recommendations to the codes or symptoms the user gave; if something is uncertain, state what was understood and what remains unclear.

KNOWLEDGE BASE (KB) CONTEXT: When the user message includes a block of ranked canonical fault matches from the knowledge base, treat them as supporting evidence, not certainty. Prefer higher-confidence ranked matches when they align with the user's codes and symptoms; use the listed reasons on the top-ranked match as evidence when relevant. If the prompt says "top matches are close in score" or "multiple faults may be plausible", preserve ambiguity—do not force a single winner when evidence is weak or conflicting. Always prioritize the user's stated codes and symptoms over KB order. If KB support is weak or unresolved codes are listed, say so explicitly in your response.

Respond using the required JSON schema: set image_quality to "N/A" when no image is provided; use visible_text and uncertain_text from the user's message; put any codes mentioned in detected_codes (raw_code and normalized_code as appropriate); fill most_likely_problem, possible_causes, recommended_checks_immediate, recommended_checks_shop_level, driver_guidance (simple, what the driver can do or observe), mechanic_guidance (technical, shop-level), can_driver_continue, safety_level, safety_message, overall_confidence from the user's text. Use empty arrays for fields that do not apply.`

const imageAnalysisSystemPrompt = `You are a heavy-duty truck diagnostic assistant for TruckHelpNow. The user may upload a photo of their truck dashboard (warnings, fault codes, gauges, messages) or a scan tool / DTC reader screenshot. Follow this sequence strictly. Do not skip steps.

EXTRACTION-FIRST SEQUENCE (follow in order):

1. TRANSCRIBE: Write all visible text exactly as shown—character-for-character. Do not correct, paraphrase, or guess. If something is unreadable, do not invent it; record only what you can actually see.

2. EXTRACT CODES: Preserve the original visible code exactly as shown—do not alter or interpret yet. List every visible fault code character-for-character as displayed. One code per entry. Do not merge digits or split codes unless the display clearly shows separate codes. Heavy-duty truck dashboard and scanner screens often show codes in compact or compressed formats (e.g. no spaces, run-together digits); record that raw form first.

3. WARNING LIGHTS & SYMBOLS: List all visible warning lights, symbols, and subsystem indicators (e.g. check engine, DEF, DPF, ABS, brake, coolant, oil, air, derate, stop engine). Describe what is lit or indicated.

4. SEPARATE CLEAR VS UNCERTAIN: Put only clearly legible text/codes in visible_text. Any text or code that is blurry, cropped, ambiguous, or partially readable must go in uncertain_text (e.g. "P11??", "last digits cut off", "blurry message"). Use image_quality to describe overall clarity ("clear", "blurry", "partial"). Never hallucinate unreadable text or codes. Never silently treat uncertain or partial readings as confident—if something is uncertain, it must appear in uncertain_text and/or as a low-confidence code; do not convert it into a confident diagnosis.

5. FAULT TIMESTAMPS AND PATTERN: If the image shows fault timestamps (e.g. first event, last event, time since set, active/inactive, occurrence count), capture them exactly in fault_timestamps—one entry per visible timestamp or time-related line (e.g. "First event: 12:34", "Last event: 14:22"). Use timestamp-based reasoning to set fault_pattern to exactly one of: intermittent (fault comes and goes; first and last event differ or multiple occurrences), recurring (fault returns periodically), persistent (fault is current/continuous; no clear on/off pattern), unclear (timestamps missing, unreadable, or ambiguous). When timestamps are visible, briefly reflect this reasoning in your interpretation; when not visible, set fault_pattern to "unclear" and leave fault_timestamps empty or use only what the user stated.

6. NORMALIZE CODES (only after step 2): First, the raw visible code must already be preserved exactly. If a code is partially visible (e.g. blurry, cropped, one digit missing), preserve the partial reading as raw_code (e.g. "P1137??" or "partially visible: P1137") and set confidence to low; do not guess missing characters. Only then attempt a normalized interpretation for clearly readable codes. Heavy-duty dashboard codes may appear in compact or compressed formats—e.g. "P113712" may represent a compressed form (P-code + digits) or "P1137" with "12" as a subcode; SPN/FMI-style codes may appear run together and need separation (e.g. "12342" → SPN 1234 FMI 2). In your response, clearly distinguish: (a) raw visible code—exactly as shown, including partial readings; (b) normalized interpretation—only when the raw form is clearly readable; (c) confidence: high only when format is unambiguous, medium when plausible, low when partially visible or uncertain. Do not guess digits; if normalization is uncertain, leave interpretation out or state it with low confidence.

7. INTERPRET SUBSYSTEM: From the codes and indicators, identify the likely subsystem(s) involved (e.g. aftertreatment/DEF/DPF, engine, brakes, electrical, fuel, cooling, emissions).

8. LIKELY CAUSES: Provide the most likely causes based only on the visible evidence and the user's written message. Use specific diagnostic reasoning (e.g. "SPN 3710 FMI 2 typically indicates…") rather than generic advice. Do not invent part numbers or repair guarantees. When uncertainty limits interpretation (e.g. codes in uncertain_text, low-confidence codes, blurry image), the diagnosis must say so: in most_likely_problem and/or missing_information, explicitly mention that partial or unreadable data limits the conclusion and what would be needed to be more specific.

9. DRIVER CHECKS: Give exactly 3 immediate, high-value checks the driver can do (e.g. DEF level, gauge readings, recent regen, lamp pattern).

10. SHOP-LEVEL CHECKS: Give deeper diagnostic or shop-level checks a technician would perform (e.g. SCR efficiency, DPF pressure, sensor checks). List these after the driver checks in recommended_checks.

11. DRIVABILITY: State clearly whether the situation appears safe to continue driving, risky (e.g. derate, limit speed), or unsafe (stop safely and seek professional help). Use safety_level and safety_message. For brakes, steering, severe overheating, fuel leak, fire risk, or critical air loss: always advise stop and professional help.

12. DRIVER GUIDANCE vs MECHANIC GUIDANCE (keep distinct; no overlap):
- driver_guidance: Written for the driver. Simple, practical language. Focus only on what the driver can safely observe (gauges, lights, messages, smell, sound) or do (e.g. check DEF level, note when the light comes on, pull over if X). Ground every sentence in visible evidence from the image (e.g. "Given the DEF warning light and code shown…"). Do not include shop procedures, tool names, or technical diagnostics.
- mechanic_guidance: Written for a technician. More technical. Focus on shop-level checks, tests, or procedures (e.g. SCR efficiency test, DPF pressure differential, sensor verification, OEM procedures). Reference the codes/lights from the image and tie each recommendation to a likely subsystem or code. Do not repeat driver-level tips; this section is for what happens in the shop.
- Both must be grounded in visible evidence from the image. Avoid generic overlap: do not put the same advice in both sections; driver_guidance = roadside/cab; mechanic_guidance = shop/technical.

ADDITIONAL RULES:
- Timestamp-based reasoning: When the image shows first event, last event, or other fault-time data, use it to decide fault_pattern (intermittent / recurring / persistent / unclear) and to populate fault_timestamps. Mention this reasoning where relevant in your interpretation.
- Forbid: inventing or guessing unreadable text, codes, or numbers; fabricating part numbers or repair guarantees; silently converting uncertain or partial readings into a confident diagnosis—uncertain content belongs in uncertain_text and/or as low-confidence codes, and the diagnosis must state when uncertainty limits interpretation.
- Prefer specific heavy-duty truck diagnostic reasoning over generic advice.
- Combine dashboard/scanner image evidence with the user's written message for a single, evidence-based response.
- Clear images: When the image is fully legible, visible_text and confident codes are sufficient; uncertain_text can be empty and confidence can be high. These rules do not require inventing uncertainty when the image is clear.

AVOID GENERIC FALLBACK ADVICE:
- Do not use vague phrases like "have the vehicle inspected" or "see a mechanic" unless you pair them with specific diagnostic reasoning (e.g. which code or subsystem points to that need).
- Do not provide generic ECU or controller advice unless the visible code or indicators actually support that interpretation; tie each recommendation to a code, light, or reading from the image or message.
- If a code or reading is not confidently recognized, say exactly what was read from the image and what remains uncertain; do not fill in with generic possibilities.
- Specific visible evidence (codes, lights, gauges, timestamps) must always be referenced in the diagnosis—most_likely_problem, possible_causes, and interpretations should cite what was actually seen.
- Every recommended check (immediate and shop-level) must be tied to a likely subsystem or to a visible code/indicator; avoid standalone generic tips.

KNOWLEDGE BASE (KB) CONTEXT: When the prompt includes a block of ranked canonical fault matches from the knowledge base, treat them as supporting evidence, not certainty. Prefer higher-confidence ranked matches when they align with visible image/text evidence and extracted codes; use the listed reasons on the top-ranked match as evidence when relevant. If the prompt says "top matches are close in score" or "multiple faults may be plausible", preserve ambiguity—do not force a single winner when evidence is weak or conflicting. Always prioritize clearly visible image/text evidence and extracted codes over KB order. If KB support is weak or unresolved codes are listed, say so explicitly (e.g. in most_likely_problem or missing_information).

Respond using the required JSON schema. Populate: image_quality (clarity: "clear", "blurry", "partial"); visible_text (only clearly legible transcribed strings); uncertain_text (any blurry, cropped, ambiguous, or partially readable text/codes—never put these only in visible_text or treat as confident); detected_codes (each with raw_code, normalized_code, code_type, confidence, interpretation); warnings_detected; fault_timestamps (capture first event, last event, and any other visible fault-time strings from the image); fault_pattern (exactly one of: "intermittent", "recurring", "persistent", "unclear"—use timestamp-based reasoning when timestamps are visible); primary_systems_involved; most_likely_problem (when uncertainty limits interpretation, say so here); possible_causes; missing_information (include "uncertain or partial image limits diagnosis" when applicable); recommended_checks_immediate (exactly 3 driver checks); recommended_checks_shop_level; driver_guidance (simple, practical, what the driver can observe or safely do—grounded in visible evidence); mechanic_guidance (technical, shop-level checks and procedures—grounded in visible codes/indicators, no overlap with driver_guidance); can_driver_continue ("yes" | "maybe" | "no"); safety_level and safety_message; overall_confidence.`

/** Pass 1 only: extract visible text, codes, warnings, timestamps. No diagnosis, causes, or recommendations. */
const extractionOnlySystemPrompt = `You are a heavy-duty truck diagnostic assistant for TruckHelpNow. The user may upload a photo of their dashboard, fault codes, or a scan tool / DTC reader screenshot, and may include a short message.

Your task in this step is EXTRACTION ONLY. Do not diagnose, recommend, or interpret causes. Output only the following in the required JSON schema:

1. TRANSCRIBE: Put all clearly legible visible text character-for-character in visible_text. Put any blurry, cropped, or uncertain text in uncertain_text.
2. IMAGE QUALITY: Set image_quality to "clear", "blurry", or "partial" based on overall clarity.
3. CODES: List every visible fault code exactly as shown in detected_codes. Preserve raw_code exactly as displayed; add normalized_code and interpretation only when clearly readable. Set confidence (low/medium/high) appropriately—use low for partial or uncertain readings. Do not guess missing digits.
4. WARNING LIGHTS: List all visible warning lights, symbols, or indicators in warnings_detected (e.g. check engine, DEF, DPF, ABS).
5. FAULT TIMESTAMPS: If the image shows first event, last event, or other fault-time data, put each visible timestamp string in fault_timestamps.

Do not fill diagnosis fields (most_likely_problem, driver_guidance, etc.)—they are not part of this schema. Respond with only: image_quality, visible_text, uncertain_text, detected_codes, warnings_detected, fault_timestamps.`

const REQUIRED_TOP_LEVEL_KEYS = [
  'image_quality',
  'visible_text',
  'uncertain_text',
  'detected_codes',
  'warnings_detected',
  'fault_timestamps',
  'fault_pattern',
  'primary_systems_involved',
  'most_likely_problem',
  'possible_causes',
  'recommended_checks_immediate',
  'recommended_checks_shop_level',
  'driver_guidance',
  'mechanic_guidance',
  'missing_information',
  'can_driver_continue',
  'safety_level',
  'safety_message',
  'overall_confidence',
] as const

class DiagnosticParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DiagnosticParseError'
  }
}

function parseDetectedCodeItem(v: unknown): DetectedCodeItem {
  if (v === null || typeof v !== 'object' || Array.isArray(v)) {
    return {
      raw_code: '',
      normalized_code: '',
      code_type: '',
      confidence: 'low',
      interpretation: '',
    }
  }
  const o = v as Record<string, unknown>
  const str = (x: unknown, fallback: string): string =>
    typeof x === 'string' ? x : fallback
  const level = (x: unknown): 'low' | 'medium' | 'high' =>
    x === 'low' || x === 'medium' || x === 'high' ? x : 'medium'
  return {
    raw_code: str(o.raw_code, ''),
    normalized_code: str(o.normalized_code, ''),
    code_type: str(o.code_type, ''),
    confidence: level(o.confidence),
    interpretation: str(o.interpretation, ''),
  }
}

function parseDiagnosticResponse(value: unknown): DiagnosticResponse {
  if (value === null || typeof value !== 'object') {
    throw new DiagnosticParseError(
      'Diagnostic response invalid: expected a JSON object, got ' +
        (value === null ? 'null' : typeof value)
    )
  }
  if (Array.isArray(value)) {
    throw new DiagnosticParseError(
      'Diagnostic response invalid: expected a JSON object, got an array'
    )
  }
  const o = value as Record<string, unknown>
  const missing = REQUIRED_TOP_LEVEL_KEYS.filter((key) => !(key in o))
  if (missing.length > 0) {
    throw new DiagnosticParseError(
      `Diagnostic response missing required fields: ${missing.join(', ')}`
    )
  }

  const arr = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
  const arrOfCodes = (v: unknown): DetectedCodeItem[] =>
    Array.isArray(v) ? v.map(parseDetectedCodeItem) : []
  const str = (v: unknown, fallback: string): string =>
    typeof v === 'string' ? v : fallback
  const level = (v: unknown): 'low' | 'medium' | 'high' =>
    v === 'low' || v === 'medium' || v === 'high' ? v : 'medium'
  const canContinue = (v: unknown): 'yes' | 'maybe' | 'no' =>
    v === 'yes' || v === 'maybe' || v === 'no' ? v : 'maybe'
  const faultPattern = (
    v: unknown
  ): 'intermittent' | 'recurring' | 'persistent' | 'unclear' =>
    v === 'intermittent' || v === 'recurring' || v === 'persistent' || v === 'unclear'
      ? v
      : 'unclear'

  return {
    image_quality: str(o.image_quality, ''),
    visible_text: arr(o.visible_text),
    uncertain_text: arr(o.uncertain_text),
    detected_codes: arrOfCodes(o.detected_codes),
    warnings_detected: arr(o.warnings_detected),
    fault_timestamps: arr(o.fault_timestamps),
    fault_pattern: faultPattern(o.fault_pattern),
    primary_systems_involved: arr(o.primary_systems_involved),
    most_likely_problem: str(o.most_likely_problem, ''),
    possible_causes: arr(o.possible_causes),
    recommended_checks_immediate: arr(o.recommended_checks_immediate),
    recommended_checks_shop_level: arr(o.recommended_checks_shop_level),
    driver_guidance: str(o.driver_guidance, ''),
    mechanic_guidance: str(o.mechanic_guidance, ''),
    missing_information: arr(o.missing_information),
    can_driver_continue: canContinue(o.can_driver_continue),
    safety_level: level(o.safety_level),
    safety_message: str(o.safety_message, ''),
    overall_confidence: level(o.overall_confidence),
  }
}

/** Parses Pass 1 extraction JSON into ExtractionResult. Uses safe defaults for missing/invalid fields. */
function parseExtractionResponse(value: unknown): ExtractionResult {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return {
      image_quality: '',
      visible_text: [],
      uncertain_text: [],
      detected_codes: [],
      warnings_detected: [],
      fault_timestamps: [],
    }
  }
  const o = value as Record<string, unknown>
  const arr = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
  const arrOfCodes = (v: unknown): DetectedCodeItem[] =>
    Array.isArray(v) ? v.map(parseDetectedCodeItem) : []
  const str = (v: unknown, fallback: string): string =>
    typeof v === 'string' ? v : fallback
  return {
    image_quality: str(o.image_quality, ''),
    visible_text: arr(o.visible_text),
    uncertain_text: arr(o.uncertain_text),
    detected_codes: arrOfCodes(o.detected_codes),
    warnings_detected: arr(o.warnings_detected),
    fault_timestamps: arr(o.fault_timestamps),
  }
}

function getDefaultDiagnosticResponse(): DiagnosticResponse {
  return {
    image_quality: '',
    visible_text: [],
    uncertain_text: [],
    detected_codes: [],
    warnings_detected: [],
    fault_timestamps: [],
    fault_pattern: 'unclear',
    primary_systems_involved: [],
    most_likely_problem: 'Unable to generate a response.',
    possible_causes: [],
    recommended_checks_immediate: [],
    recommended_checks_shop_level: [],
    driver_guidance: '',
    mechanic_guidance: '',
    missing_information: [],
    can_driver_continue: 'maybe',
    safety_level: 'medium',
    safety_message: '',
    overall_confidence: 'low',
  }
}

/** Builds a concise, readable text summary from the structured diagnostic for use as the assistant message content (backward compatible with text chat rendering). */
function formatDiagnosticReply(diagnostic: DiagnosticResponse): string {
  const parts: string[] = []
  if (diagnostic.most_likely_problem) {
    parts.push(diagnostic.most_likely_problem)
  }
  if (diagnostic.driver_guidance) {
    parts.push(diagnostic.driver_guidance)
  }
  if (diagnostic.safety_message) {
    parts.push(diagnostic.safety_message)
  }
  const canContinue =
    diagnostic.can_driver_continue === 'yes'
      ? 'Safe to continue with caution.'
      : diagnostic.can_driver_continue === 'no'
        ? 'Do not continue until checked.'
        : ''
  if (canContinue) parts.push(canContinue)
  if (diagnostic.recommended_checks_immediate.length > 0) {
    const next = diagnostic.recommended_checks_immediate.slice(0, 2).join('; ')
    parts.push(`Next: ${next}`)
  }
  return parts.filter(Boolean).join('\n\n') || 'Diagnostic analysis complete. See details below.'
}

type KnowledgeContext = Awaited<ReturnType<typeof resolveTruckFaultContext>>

/** Score difference below which we treat top two ranked faults as ambiguous (preserve multiple candidates). */
const RANKED_TIE_THRESHOLD = 8

/**
 * True when we have at least two ranked faults and the top two scores are close enough to preserve ambiguity.
 */
function isRankedAmbiguous(ctx: KnowledgeContext): boolean {
  const ranked = ctx.rankedCanonicalFaults ?? []
  if (ranked.length < 2) return false
  const [first, second] = ranked
  return (first.score - second.score) <= RANKED_TIE_THRESHOLD
}

/**
 * Builds a compact factual summary of knowledge context for injection into the model prompt.
 * Prefers rankedCanonicalFaults for order/summary; preserves ambiguity when top matches are close.
 * Returns empty string if there is no useful content to add.
 */
function formatKnowledgeContextForPrompt(ctx: KnowledgeContext): string {
  const lines: string[] = []
  if (ctx.matchedBrand) {
    lines.push(`Matched brand (supporting): ${ctx.matchedBrand.name}.`)
  }
  if (ctx.matchedModules.length > 0) {
    const names = [...new Set(ctx.matchedModules.slice(0, 3).map((m) => m.name))]
    lines.push(`Matched ECU/modules: ${names.join(', ')}.`)
  }
  const ranked = ctx.rankedCanonicalFaults ?? []
  const faultCount = ctx.matchedCanonicalFaults.length
  if (faultCount > 0) {
    const take = 3
    if (ranked.length > 0) {
      lines.push('Canonical fault matches from KB (ranked, use for prioritization):')
      const topRanked = ranked.slice(0, take)
      topRanked.forEach((r, i) => {
        const codeTitle = `${r.fault.code}: ${r.fault.title}`
        if (i === 0) {
          const reasons = r.reasons.slice(0, 2).join('; ') || '—'
          lines.push(`  1. ${codeTitle}. Confidence: ${r.confidence}. Reasons: ${reasons}.`)
        } else {
          lines.push(`  ${i + 1}. ${codeTitle}. Confidence: ${r.confidence}.`)
        }
      })
      if (faultCount > take) {
        lines.push(`  (+${faultCount - take} more matched in KB.)`)
      }
      if (isRankedAmbiguous(ctx)) {
        lines.push('  Note: Top matches are close in score; multiple faults may be plausible.')
      }
    } else {
      const top = ctx.matchedCanonicalFaults.slice(0, take)
      const summary = top.map((f) => `${f.code}: ${f.title}`).join('; ')
      const more = faultCount > take ? ` (+${faultCount - take} more)` : ''
      lines.push(`Canonical fault matches from KB: ${summary}${more}.`)
      if (faultCount > 1) {
        lines.push('  (Multiple matches — preserve ambiguity when evidence is weak.)')
      }
    }
  }
  if (ctx.matchedProcedures.length > 0) {
    const few = ctx.matchedProcedures.slice(0, 3).map((p) => p.title).join('; ')
    lines.push(`Suggested procedures from KB: ${few}${ctx.matchedProcedures.length > 3 ? ` (+${ctx.matchedProcedures.length - 3} more)` : ''}.`)
  }
  if (ctx.unresolvedCodes.length > 0) {
    const codes = ctx.unresolvedCodes.slice(0, 5).join(', ')
    lines.push(`Codes not found in KB: ${codes}${ctx.unresolvedCodes.length > 5 ? ` (${ctx.unresolvedCodes.length - 5} more)` : ''}.`)
  }
  if (ctx.confidenceNotes.length > 0) {
    const notes = ctx.confidenceNotes.slice(0, 2).join(' ')
    lines.push(`Notes: ${notes}`)
  }
  return lines.filter(Boolean).join('\n')
}

/**
 * Builds a compact summary of the extraction result for Pass 2 prompt (so the model has the extracted evidence without re-reading the image alone).
 */
function formatExtractionSummary(extraction: ExtractionResult): string {
  const lines: string[] = []
  lines.push(`Image quality: ${extraction.image_quality || 'not specified'}.`)
  if (extraction.visible_text.length > 0) {
    const text = extraction.visible_text.slice(0, 15).join('; ')
    lines.push(`Visible text: ${text}${extraction.visible_text.length > 15 ? '…' : ''}.`)
  }
  if (extraction.uncertain_text.length > 0) {
    const u = extraction.uncertain_text.slice(0, 5).join('; ')
    lines.push(`Uncertain text: ${u}${extraction.uncertain_text.length > 5 ? '…' : ''}.`)
  }
  if (extraction.detected_codes.length > 0) {
    const codes = extraction.detected_codes
      .slice(0, 10)
      .map((c) => `${c.raw_code}${c.normalized_code ? ` → ${c.normalized_code}` : ''} (${c.confidence})`)
      .join('; ')
    lines.push(`Detected codes: ${codes}${extraction.detected_codes.length > 10 ? '…' : ''}.`)
  }
  if (extraction.warnings_detected.length > 0) {
    lines.push(`Warnings/lights: ${extraction.warnings_detected.slice(0, 8).join('; ')}${extraction.warnings_detected.length > 8 ? '…' : ''}.`)
  }
  if (extraction.fault_timestamps.length > 0) {
    lines.push(`Fault timestamps: ${extraction.fault_timestamps.slice(0, 5).join('; ')}.`)
  }
  return lines.filter(Boolean).join('\n')
}

/**
 * Assembles the Pass 2 user prompt: context prefix, extraction summary, grounding block, and user message.
 */
function buildGroundedDiagnosisPromptInput(opts: {
  userContextPrefix: string
  extractionSummary: string
  groundingBlock: string
  message: string
}): string {
  const { userContextPrefix, extractionSummary, groundingBlock, message } = opts
  const extractionBlock =
    extractionSummary.trim().length > 0
      ? '[Extraction from image/message — use this evidence for your diagnosis.]\n' +
        extractionSummary.trim() +
        '\n\n'
      : ''
  return userContextPrefix + extractionBlock + groundingBlock + (message || '')
}

/**
 * Builds a short, evidence-based appendix from knowledge context.
 * Prefers ranked canonical faults (top 3); uses ambiguous wording when top two scores are close.
 */
function formatKnowledgeContextReply(ctx: KnowledgeContext): string {
  const lines: string[] = []
  const faultCount = ctx.matchedCanonicalFaults.length
  if (faultCount > 0) {
    const ranked = ctx.rankedCanonicalFaults ?? []
    const top = ranked.length > 0 ? ranked.slice(0, 3) : ctx.matchedCanonicalFaults.slice(0, 3).map((f) => ({ fault: f, score: 0, reasons: [] as string[], confidence: 'low' as const }))
    const summary = top.map((r) => `${r.fault.code} (${r.fault.title})`).join('; ')
    const suffix = faultCount > 3 ? ` (+${faultCount - 3} more)` : ''
    const ambiguous = isRankedAmbiguous(ctx)
    const intro = ambiguous
      ? 'Knowledge base matches (top candidates — evidence is close; consider multiple): '
      : 'Knowledge base matches: '
    lines.push(`${intro}${summary}${suffix}.`)
  }
  if (ctx.matchedProcedures.length > 0) {
    const few = ctx.matchedProcedures.slice(0, 3).map((p) => p.title).join('; ')
    const suffix = ctx.matchedProcedures.length > 3 ? ` (+${ctx.matchedProcedures.length - 3} more)` : ''
    lines.push(`Suggested procedures from KB: ${few}${suffix}.`)
  }
  if (ctx.unresolvedCodes.length > 0) {
    const codes = ctx.unresolvedCodes.slice(0, 5).join(', ')
    const suffix = ctx.unresolvedCodes.length > 5 ? ` (${ctx.unresolvedCodes.length - 5} more not in KB)` : ''
    lines.push(`Not in knowledge base: ${codes}${suffix}.`)
  }
  if (ctx.matchedModules.length > 0 && ctx.matchedCanonicalFaults.length > 0) {
    const names = [...new Set(ctx.matchedModules.slice(0, 2).map((m) => m.name))]
    if (names.length > 0) {
      lines.push(`Relevant modules: ${names.join(', ')}.`)
    }
  }
  if (ctx.matchedBrand && ctx.matchedBrandOverrides.length > 0) {
    lines.push(`Brand-specific notes available for ${ctx.matchedBrand.name}.`)
  }
  return lines.filter(Boolean).join('\n')
}

function getOpenAIKey(): string | null {
  const key = process.env.OPENAI_API_KEY?.trim()
  if (!key) return null
  // Reject placeholders / truncated keys (real keys are long)
  if (
    key.length < 30 ||
    key === 'sk-proj-' ||
    (key.startsWith('sk-proj-') && key.length < 40)
  ) {
    return null
  }
  return key
}

/** Structured log for chat route observability. One JSON line per event; no PII or raw payloads. */
function logChatEvent(event: string, meta?: Record<string, unknown>) {
  console.log(JSON.stringify({ event, route: 'chat', ...meta }))
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData()

    const messageEntry = formData.get('message')
    const message =
      typeof messageEntry === 'string' ? messageEntry.trim() : ''

    const imageEntry = formData.get('image')
    const image = imageEntry instanceof File ? imageEntry : null

    if (!message && !image) {
      return NextResponse.json(
        { error: 'message or image is required' },
        { status: 400 }
      )
    }

    if (image) {
      if (!ALLOWED_IMAGE_TYPES.includes(image.type as (typeof ALLOWED_IMAGE_TYPES)[number])) {
        return NextResponse.json(
          {
            error: `Invalid image type. Allowed: ${ALLOWED_IMAGE_TYPES.join(', ')}. Received: ${image.type || 'unknown'}.`,
          },
          { status: 400 }
        )
      }
      if (image.size > MAX_IMAGE_SIZE_BYTES) {
        return NextResponse.json(
          {
            error: `Image too large. Maximum size is ${MAX_IMAGE_SIZE_BYTES / (1024 * 1024)} MB. Received: ${(image.size / (1024 * 1024)).toFixed(2)} MB.`,
          },
          { status: 400 }
        )
      }
    }

    let imageDataUrl: string | null = null
    if (image) {
      const arrayBuffer = await image.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      const base64 = buffer.toString('base64')
      const mimeType = image.type || 'image/png'
      imageDataUrl = `data:${mimeType};base64,${base64}`
    }

    const apiKey = getOpenAIKey()
    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            'OpenAI API key is missing or invalid. Add a valid key to .env.local as OPENAI_API_KEY=sk-... and restart the dev server.',
        },
        { status: 500 }
      )
    }

    /** Prepended to the user turn so the model receives heavy-duty truck context. */
    const userContextPrefix = `[Context: TruckHelpNow is for heavy-duty trucks. The user may be a driver, dispatcher, or shop staff. Any uploaded image may be a dashboard photo or a scan tool / DTC reader screenshot. Prefer truck-specific fault interpretation (e.g. J1939, aftertreatment, diesel systems) over generic passenger-car diagnostics.]\n\n`

    const hasImage = imageDataUrl != null
    const hasMessage = message.length > 0
    const requestStart = Date.now()
    logChatEvent('request_received', {
      hasImage,
      hasMessage,
      flow_type: hasImage ? 'image' : 'text_only',
      requestStart,
    })

    const openai = new OpenAI({ apiKey })
    let diagnostic: DiagnosticResponse
    let knowledgeContext: Awaited<ReturnType<typeof resolveTruckFaultContext>> | null = null
    /** Set only for image requests: true = two-pass succeeded, false = fallback used. */
    let usedTwoPassFlow: boolean | undefined
    /** Set only for text-only: duration of the single model call in ms. */
    let textOnlyModelDurationMs: number | undefined

    if (imageDataUrl == null) {
      // ─── Text-only: single-pass with message-based grounding ─────────────────
      let preCallKnowledgeContext: KnowledgeContext | null = null
      const preCallKbStart = Date.now()
      try {
        const extracted = extractTruckEvidence([], message || null)
        preCallKnowledgeContext = await resolveTruckFaultContext({
          rawCodes: extracted.rawCodes,
          ecuLabels: extracted.ecuLabels,
          spnFmiCandidates: extracted.spnFmiCandidates,
          suspectedBrand: extracted.suspectedBrand,
          visibleText: [],
          userMessage: message || null,
        })
        logChatEvent('knowledge_resolution', {
          flow_type: 'text_only',
          stage: 'pre_call',
          success: true,
          durationMs: Date.now() - preCallKbStart,
          matchedCanonicalFaults: preCallKnowledgeContext?.matchedCanonicalFaults?.length ?? 0,
          unresolvedCodes: preCallKnowledgeContext?.unresolvedCodes?.length ?? 0,
        })
      } catch (e) {
        logChatEvent('knowledge_resolution', {
          flow_type: 'text_only',
          stage: 'pre_call',
          success: false,
          durationMs: Date.now() - preCallKbStart,
          reason: e instanceof Error ? e.message : String(e),
        })
        console.error('POST /api/chat pre-call knowledge resolution failed:', e)
      }
      const groundingSummary =
        preCallKnowledgeContext != null
          ? formatKnowledgeContextForPrompt(preCallKnowledgeContext)
          : ''
      const groundingBlock =
        groundingSummary.trim().length > 0
          ? '[Supporting context from knowledge base — use to inform your response where relevant; not definitive. Multiple matches indicate ambiguity.]\n' +
            groundingSummary.trim() +
            '\n\n'
          : ''

      const userContentParts: OpenAI.Chat.ChatCompletionContentPart[] = [
        {
          type: 'text',
          text: userContextPrefix + groundingBlock + message,
        },
      ]
      const textOnlyModelStart = Date.now()
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContentParts },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'diagnostic_response',
            strict: true,
            schema: DIAGNOSTIC_RESPONSE_SCHEMA,
          },
        },
      })
      textOnlyModelDurationMs = Date.now() - textOnlyModelStart
      const rawContent = completion.choices[0]?.message?.content?.trim()
      if (!rawContent) {
        logChatEvent('diagnostic_failed', { flow_type: 'text_only', stage: 'model_response', reason: 'empty_content' })
        return NextResponse.json(
          { error: 'No content in model response' },
          { status: 500 }
        )
      }
      let parsed: unknown
      try {
        parsed = JSON.parse(rawContent)
      } catch {
        logChatEvent('diagnostic_failed', { flow_type: 'text_only', stage: 'model_response', reason: 'invalid_json' })
        return NextResponse.json(
          { error: 'Invalid JSON in model response' },
          { status: 500 }
        )
      }
      try {
        diagnostic = parseDiagnosticResponse(parsed)
      } catch (e) {
        const errMsg =
          e instanceof DiagnosticParseError
            ? e.message
            : 'Diagnostic response structure invalid. Please try again.'
        logChatEvent('diagnostic_failed', { flow_type: 'text_only', stage: 'parse', reason: errMsg })
        console.error('POST /api/chat parse error:', e)
        return NextResponse.json({ error: errMsg }, { status: 500 })
      }
      const postCallKbStart = Date.now()
      try {
        const visibleText = diagnostic.visible_text ?? []
        const extracted = extractTruckEvidence(visibleText, message || null)
        const rawCodesFromDiagnostic = [
          ...diagnostic.detected_codes.map((c) => c.raw_code).filter(Boolean),
          ...diagnostic.detected_codes.map((c) => c.normalized_code).filter(Boolean),
        ]
        const allRawCodes = [...new Set([...extracted.rawCodes, ...rawCodesFromDiagnostic])]
        knowledgeContext = await resolveTruckFaultContext({
          rawCodes: allRawCodes,
          ecuLabels: extracted.ecuLabels,
          spnFmiCandidates: extracted.spnFmiCandidates,
          suspectedBrand: extracted.suspectedBrand,
          visibleText,
          userMessage: message || null,
        })
        logChatEvent('knowledge_resolution', {
          flow_type: 'text_only',
          stage: 'post_call',
          success: true,
          durationMs: Date.now() - postCallKbStart,
          matchedCanonicalFaults: knowledgeContext?.matchedCanonicalFaults?.length ?? 0,
          unresolvedCodes: knowledgeContext?.unresolvedCodes?.length ?? 0,
        })
      } catch (e) {
        logChatEvent('knowledge_resolution', {
          flow_type: 'text_only',
          stage: 'post_call',
          success: false,
          durationMs: Date.now() - postCallKbStart,
          reason: e instanceof Error ? e.message : String(e),
        })
        console.error('POST /api/chat knowledge resolution failed:', e)
      }
    } else {
      // ─── Image or image+text: two-pass preferred; fallback to single-pass on Pass 1/2 failure ───
      usedTwoPassFlow = true
      const pass1Start = Date.now()
      try {
        logChatEvent('pass1_started', { hasImage: true, hasMessage })
        const pass1UserParts: OpenAI.Chat.ChatCompletionContentPart[] = [
          {
            type: 'text',
            text: userContextPrefix.trim() + (message ? '\n\n' + message : ''),
          },
          { type: 'image_url', image_url: { url: imageDataUrl } },
        ]
        const pass1Completion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: extractionOnlySystemPrompt },
            { role: 'user', content: pass1UserParts },
          ],
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'extraction_response',
              strict: true,
              schema: EXTRACTION_RESPONSE_SCHEMA,
            },
          },
        })
        const pass1Raw = pass1Completion.choices[0]?.message?.content?.trim()
        if (!pass1Raw) {
          throw new Error('Empty content in extraction (Pass 1) response')
        }
        let pass1Parsed: unknown
        try {
          pass1Parsed = JSON.parse(pass1Raw)
        } catch {
          throw new Error('Invalid JSON in extraction (Pass 1) response')
        }
        const extraction = parseExtractionResponse(pass1Parsed)
        logChatEvent('pass1_succeeded', {
          durationMs: Date.now() - pass1Start,
          visibleTextLines: extraction.visible_text?.length ?? 0,
          detectedCodes: extraction.detected_codes?.length ?? 0,
          warningsDetected: extraction.warnings_detected?.length ?? 0,
        })

        const extracted = extractTruckEvidence(extraction.visible_text, message || null)
        const rawCodesFromExtraction = [
          ...extraction.detected_codes.map((c) => c.raw_code).filter(Boolean),
          ...extraction.detected_codes.map((c) => c.normalized_code).filter(Boolean),
        ]
        const allRawCodes = [...new Set([...extracted.rawCodes, ...rawCodesFromExtraction])]
        const kbAfterPass1Start = Date.now()
        try {
          knowledgeContext = await resolveTruckFaultContext({
            rawCodes: allRawCodes,
            ecuLabels: extracted.ecuLabels,
            spnFmiCandidates: extracted.spnFmiCandidates,
            suspectedBrand: extracted.suspectedBrand,
            visibleText: extraction.visible_text,
            userMessage: message || null,
          })
          logChatEvent('knowledge_resolution', {
            flow_type: 'image_two_pass',
            stage: 'after_pass1',
            success: true,
            durationMs: Date.now() - kbAfterPass1Start,
            matchedCanonicalFaults: knowledgeContext?.matchedCanonicalFaults?.length ?? 0,
            unresolvedCodes: knowledgeContext?.unresolvedCodes?.length ?? 0,
          })
        } catch (e) {
          logChatEvent('knowledge_resolution', {
            flow_type: 'image_two_pass',
            stage: 'after_pass1',
            success: false,
            durationMs: Date.now() - kbAfterPass1Start,
            reason: e instanceof Error ? e.message : String(e),
          })
          console.error('POST /api/chat knowledge resolution (two-pass) failed:', e)
        }

        const groundingSummary =
          knowledgeContext != null
            ? formatKnowledgeContextForPrompt(knowledgeContext)
            : ''
        const groundingBlock =
          groundingSummary.trim().length > 0
            ? '[Supporting context from knowledge base — use to inform your response where relevant; not definitive. Multiple matches indicate ambiguity.]\n' +
              groundingSummary.trim() +
              '\n\n'
            : ''
        const extractionSummary = formatExtractionSummary(extraction)
        const pass2Text = buildGroundedDiagnosisPromptInput({
          userContextPrefix,
          extractionSummary,
          groundingBlock,
          message: message || '',
        })
        const pass2UserParts: OpenAI.Chat.ChatCompletionContentPart[] = [
          { type: 'text', text: pass2Text },
          { type: 'image_url', image_url: { url: imageDataUrl } },
        ]
        logChatEvent('pass2_started', { hasImage: true, hasMessage })
        const pass2Start = Date.now()
        const pass2Completion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: imageAnalysisSystemPrompt },
            { role: 'user', content: pass2UserParts },
          ],
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'diagnostic_response',
              strict: true,
              schema: DIAGNOSTIC_RESPONSE_SCHEMA,
            },
          },
        })
        const pass2Raw = pass2Completion.choices[0]?.message?.content?.trim()
        if (!pass2Raw) {
          throw new Error('Empty content in diagnosis (Pass 2) response')
        }
        let pass2Parsed: unknown
        try {
          pass2Parsed = JSON.parse(pass2Raw)
        } catch {
          throw new Error('Invalid JSON in diagnosis (Pass 2) response')
        }
        diagnostic = parseDiagnosticResponse(pass2Parsed)
        logChatEvent('pass2_succeeded', {
          durationMs: Date.now() - pass2Start,
          visibleTextLines: diagnostic.visible_text?.length ?? 0,
          detectedCodes: diagnostic.detected_codes?.length ?? 0,
        })
      } catch (twoPassError) {
        usedTwoPassFlow = false
        const reason =
          twoPassError instanceof Error ? twoPassError.message : String(twoPassError)
        logChatEvent('fallback_used', {
          reason,
          hasImage: true,
          hasMessage,
          usedTwoPassFlow: false,
          pass1DurationMs: Date.now() - pass1Start,
        })
        console.warn(
          'POST /api/chat image request: two-pass flow failed, using single-pass fallback. Reason:',
          reason
        )

        const fallbackUserParts: OpenAI.Chat.ChatCompletionContentPart[] = [
          {
            type: 'text',
            text: userContextPrefix.trim() + (message ? '\n\n' + message : ''),
          },
          { type: 'image_url', image_url: { url: imageDataUrl } },
        ]
        const fallbackStart = Date.now()
        const fallbackCompletion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: imageAnalysisSystemPrompt },
            { role: 'user', content: fallbackUserParts },
          ],
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'diagnostic_response',
              strict: true,
              schema: DIAGNOSTIC_RESPONSE_SCHEMA,
            },
          },
        })
        const fallbackRaw = fallbackCompletion.choices[0]?.message?.content?.trim()
        if (!fallbackRaw) {
          logChatEvent('fallback_failed', {
            stage: 'model_response',
            reason: 'empty_content',
            usedTwoPassFlow: false,
          })
          return NextResponse.json(
            { error: 'No content in model response (fallback)' },
            { status: 500 }
          )
        }
        let fallbackParsed: unknown
        try {
          fallbackParsed = JSON.parse(fallbackRaw)
        } catch {
          logChatEvent('fallback_failed', {
            stage: 'model_response',
            reason: 'invalid_json',
            usedTwoPassFlow: false,
          })
          return NextResponse.json(
            { error: 'Invalid JSON in model response (fallback)' },
            { status: 500 }
          )
        }
        try {
          diagnostic = parseDiagnosticResponse(fallbackParsed)
        } catch (e) {
          const errMsg =
            e instanceof DiagnosticParseError
              ? e.message
              : 'Diagnostic response structure invalid. Please try again.'
          logChatEvent('fallback_failed', {
            stage: 'parse',
            reason: errMsg,
            usedTwoPassFlow: false,
          })
          console.error('POST /api/chat fallback parse error:', e)
          return NextResponse.json({ error: errMsg }, { status: 500 })
        }
        logChatEvent('fallback_succeeded', {
          durationMs: Date.now() - fallbackStart,
          visibleTextLines: diagnostic.visible_text?.length ?? 0,
          detectedCodes: diagnostic.detected_codes?.length ?? 0,
          usedTwoPassFlow: false,
        })
        const fallbackKbStart = Date.now()
        try {
          const visibleText = diagnostic.visible_text ?? []
          const extracted = extractTruckEvidence(visibleText, message || null)
          const rawCodesFromDiagnostic = [
            ...diagnostic.detected_codes.map((c) => c.raw_code).filter(Boolean),
            ...diagnostic.detected_codes.map((c) => c.normalized_code).filter(Boolean),
          ]
          const allRawCodes = [...new Set([...extracted.rawCodes, ...rawCodesFromDiagnostic])]
          knowledgeContext = await resolveTruckFaultContext({
            rawCodes: allRawCodes,
            ecuLabels: extracted.ecuLabels,
            spnFmiCandidates: extracted.spnFmiCandidates,
            suspectedBrand: extracted.suspectedBrand,
            visibleText,
            userMessage: message || null,
          })
          logChatEvent('knowledge_resolution', {
            flow_type: 'image_fallback',
            stage: 'post_call',
            success: true,
            durationMs: Date.now() - fallbackKbStart,
            matchedCanonicalFaults: knowledgeContext?.matchedCanonicalFaults?.length ?? 0,
            unresolvedCodes: knowledgeContext?.unresolvedCodes?.length ?? 0,
          })
        } catch (e) {
          logChatEvent('knowledge_resolution', {
            flow_type: 'image_fallback',
            stage: 'post_call',
            success: false,
            durationMs: Date.now() - fallbackKbStart,
            reason: e instanceof Error ? e.message : String(e),
          })
          console.error('POST /api/chat knowledge resolution failed (fallback):', e)
        }
      }
    }

    const consistencyResult = checkDiagnosticConsistency(
      {
        most_likely_problem: diagnostic.most_likely_problem,
        missing_information: diagnostic.missing_information ?? [],
        overall_confidence: diagnostic.overall_confidence,
        primary_systems_involved: diagnostic.primary_systems_involved ?? [],
      },
      knowledgeContext
        ? {
            rankedCanonicalFaults: knowledgeContext.rankedCanonicalFaults?.map((r) => ({
              fault: { subsystem: r.fault.subsystem },
              score: r.score,
            })),
            unresolvedCodes: knowledgeContext.unresolvedCodes,
            matchedModules: knowledgeContext.matchedModules?.map((m) => ({ subsystem: m.subsystem })),
          }
        : null
    )

    let reply = formatDiagnosticReply(diagnostic)
    if (!consistencyResult.isConsistent) {
      logChatEvent('diagnostic_consistency_check', {
        isConsistent: false,
        warningCount: consistencyResult.warnings.length,
        severity: consistencyResult.severity,
        warnings: consistencyResult.warnings,
      })
      const honestyNote =
        consistencyResult.severity === 'medium'
          ? 'The diagnosis may be less reliable because evidence and knowledge-base signals do not fully align; consider professional verification when in doubt.'
          : 'Diagnostic confidence is limited because the available evidence and knowledge-base signals are not fully aligned.'
      reply = reply + '\n\n' + honestyNote
    }
    if (knowledgeContext) {
      const appendix = formatKnowledgeContextReply(knowledgeContext)
      if (appendix) {
        reply = reply + '\n\n' + appendix
      }
    }

    const flowType =
      !hasImage ? 'text_only' : usedTwoPassFlow === true ? 'image_two_pass' : 'image_fallback'
    logChatEvent('response_completed', {
      flow_type: flowType,
      hasImage,
      hasMessage,
      totalDurationMs: Date.now() - requestStart,
      ...(typeof usedTwoPassFlow === 'boolean' ? { usedTwoPassFlow } : {}),
      ...(textOnlyModelDurationMs !== undefined ? { modelCallDurationMs: textOnlyModelDurationMs } : {}),
      visibleTextLines: diagnostic.visible_text?.length ?? 0,
      detectedCodes: diagnostic.detected_codes?.length ?? 0,
      matchedCanonicalFaults: knowledgeContext?.matchedCanonicalFaults?.length ?? 0,
      unresolvedCodes: knowledgeContext?.unresolvedCodes?.length ?? 0,
    })

    return NextResponse.json({
      reply,
      structured: diagnostic,
      knowledgeContext,
      ...(typeof usedTwoPassFlow === 'boolean' ? { usedTwoPassFlow } : {}),
      diagnosticConsistency: consistencyResult,
    })
  } catch (e) {
    logChatEvent('request_failed', {
      reason: e instanceof Error ? e.message : String(e),
    })
    console.error('POST /api/chat:', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Chat failed' },
      { status: 500 }
    )
  }
}
