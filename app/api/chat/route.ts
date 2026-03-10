import { NextResponse } from 'next/server'
import OpenAI from 'openai'

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

const systemPrompt = `You are a truck diagnostic assistant for TruckHelpNow. Help drivers with:
- Truck year, make, model, and engine type
- Symptoms and fault codes (SPN/FMI when available)
- Drivers can also upload photos of their dashboard (warnings, lights, gauges) or scan tool / DTC reader screens for analysis.
Keep answers concise and practical. Always recommend professional help for brakes, steering, overheating, fuel leaks, or fire risk. This is informational guidance only.
Avoid generic fallback: tie recommendations to the codes or symptoms the user gave; if something is uncertain, state what was understood and what remains unclear.

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

Respond using the required JSON schema. Populate: image_quality (clarity: "clear", "blurry", "partial"); visible_text (only clearly legible transcribed strings); uncertain_text (any blurry, cropped, ambiguous, or partially readable text/codes—never put these only in visible_text or treat as confident); detected_codes (each with raw_code, normalized_code, code_type, confidence, interpretation); warnings_detected; fault_timestamps (capture first event, last event, and any other visible fault-time strings from the image); fault_pattern (exactly one of: "intermittent", "recurring", "persistent", "unclear"—use timestamp-based reasoning when timestamps are visible); primary_systems_involved; most_likely_problem (when uncertainty limits interpretation, say so here); possible_causes; missing_information (include "uncertain or partial image limits diagnosis" when applicable); recommended_checks_immediate (exactly 3 driver checks); recommended_checks_shop_level; driver_guidance (simple, practical, what the driver can observe or safely do—grounded in visible evidence); mechanic_guidance (technical, shop-level checks and procedures—grounded in visible codes/indicators, no overlap with driver_guidance); can_driver_continue ("yes" | "maybe" | "no"); safety_level and safety_message; overall_confidence.`

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

    const systemContent =
      imageDataUrl != null ? imageAnalysisSystemPrompt : systemPrompt

    /** Prepended to the user turn so the model receives heavy-duty truck context (audience, image type, preferred interpretation). */
    const userContextPrefix = `[Context: TruckHelpNow is for heavy-duty trucks. The user may be a driver, dispatcher, or shop staff. Any uploaded image may be a dashboard photo or a scan tool / DTC reader screenshot. Prefer truck-specific fault interpretation (e.g. J1939, aftertreatment, diesel systems) over generic passenger-car diagnostics.]\n\n`

    const userContentParts: OpenAI.Chat.ChatCompletionContentPart[] = []
    if (message) {
      userContentParts.push({ type: 'text', text: userContextPrefix + message })
    } else if (imageDataUrl) {
      userContentParts.push({ type: 'text', text: userContextPrefix.trim() })
    }
    if (imageDataUrl) {
      userContentParts.push({
        type: 'image_url',
        image_url: { url: imageDataUrl },
      })
    }
    if (userContentParts.length === 0) {
      return NextResponse.json(
        { error: 'message or image is required' },
        { status: 400 }
      )
    }

    const openai = new OpenAI({ apiKey })
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemContent },
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

    const rawContent = completion.choices[0]?.message?.content?.trim()
    if (!rawContent) {
      return NextResponse.json(
        { error: 'No content in model response' },
        { status: 500 }
      )
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(rawContent)
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON in model response' },
        { status: 500 }
      )
    }

    let diagnostic: DiagnosticResponse
    try {
      diagnostic = parseDiagnosticResponse(parsed)
    } catch (e) {
      const message =
        e instanceof DiagnosticParseError
          ? e.message
          : 'Diagnostic response structure invalid. Please try again.'
      console.error('POST /api/chat parse error:', e)
      return NextResponse.json({ error: message }, { status: 500 })
    }

    const reply = formatDiagnosticReply(diagnostic)

    return NextResponse.json({
      reply,
      structured: diagnostic,
    })
  } catch (e) {
    console.error('POST /api/chat:', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Chat failed' },
      { status: 500 }
    )
  }
}
