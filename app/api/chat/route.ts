import { NextResponse } from 'next/server'
import OpenAI from 'openai'

const ALLOWED_IMAGE_TYPES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
] as const
const MAX_IMAGE_SIZE_BYTES = 8 * 1024 * 1024 // 8 MB

const DIAGNOSTIC_RESPONSE_SCHEMA = {
  type: 'object' as const,
  properties: {
    image_quality: { type: 'string' },
    codes_detected: { type: 'array', items: { type: 'string' } },
    warnings_detected: { type: 'array', items: { type: 'string' } },
    likely_issue_summary: { type: 'string' },
    recommended_checks: { type: 'array', items: { type: 'string' } },
    safety_level: { type: 'string', enum: ['low', 'medium', 'high'] },
    safety_message: { type: 'string' },
    confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
    note: { type: 'string' },
  },
  required: [
    'image_quality',
    'codes_detected',
    'warnings_detected',
    'likely_issue_summary',
    'recommended_checks',
    'safety_level',
    'safety_message',
    'confidence',
    'note',
  ],
  additionalProperties: false,
}

export type DiagnosticResponse = {
  image_quality: string
  codes_detected: string[]
  warnings_detected: string[]
  likely_issue_summary: string
  recommended_checks: string[]
  safety_level: 'low' | 'medium' | 'high'
  safety_message: string
  confidence: 'low' | 'medium' | 'high'
  note: string
}

const systemPrompt = `You are a truck diagnostic assistant for TruckHelpNow. Help drivers with:
- Truck year, make, model, and engine type
- Symptoms and fault codes (SPN/FMI when available)
- Drivers can also upload photos of their dashboard (warnings, lights, gauges) or scan tool / DTC reader screens for analysis.
Keep answers concise and practical. Always recommend professional help for brakes, steering, overheating, fuel leaks, or fire risk. This is informational guidance only.

Respond using the required JSON schema: set image_quality to "N/A" when no image is provided; fill other fields from the user's text.`

const imageAnalysisSystemPrompt = `You are a truck diagnostic assistant for TruckHelpNow. The user may upload a photo of their truck dashboard (warnings, fault codes, gauges) or a scan tool / DTC reader screenshot.

- Analyze the image: dashboard photos (warning lights, gauges, messages) or scan tool / scanner screenshots.
- Extract and report only what is clearly visible: fault codes (SPN/FMI or P-codes), warning lights, symbols, gauges, and any dashboard or scanner text.
- Combine image evidence with the user's written message; use both to give relevant guidance.
- If text or codes are blurry, partially visible, or unreadable, say so clearly. Do not guess or invent codes or numbers.
- Provide technical guidance only; do not guarantee diagnosis or repair. Do not invent part numbers or repair guarantees.
- Flag safety-critical issues explicitly: brake warnings, low oil pressure, high coolant temperature, low air pressure, severe derate, or shutdown risk. Advise the user to stop safely and seek professional help when appropriate.
- Prefer concise, structured output that is machine-usable where possible.

Respond using the required JSON schema. Set image_quality to describe clarity of the image (e.g. "clear", "blurry", "partial"); extract codes and warnings from the image and user message.`

function parseDiagnosticResponse(value: unknown): DiagnosticResponse {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return getDefaultDiagnosticResponse()
  }
  const o = value as Record<string, unknown>
  const arr = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
  const str = (v: unknown, fallback: string): string =>
    typeof v === 'string' ? v : fallback
  const level = (v: unknown): 'low' | 'medium' | 'high' =>
    v === 'low' || v === 'medium' || v === 'high' ? v : 'medium'
  return {
    image_quality: str(o.image_quality, ''),
    codes_detected: arr(o.codes_detected),
    warnings_detected: arr(o.warnings_detected),
    likely_issue_summary: str(o.likely_issue_summary, ''),
    recommended_checks: arr(o.recommended_checks),
    safety_level: level(o.safety_level),
    safety_message: str(o.safety_message, ''),
    confidence: level(o.confidence),
    note: str(o.note, ''),
  }
}

function getDefaultDiagnosticResponse(): DiagnosticResponse {
  return {
    image_quality: '',
    codes_detected: [],
    warnings_detected: [],
    likely_issue_summary: 'Unable to generate a response.',
    recommended_checks: [],
    safety_level: 'medium',
    safety_message: '',
    confidence: 'low',
    note: '',
  }
}

function formatDiagnosticReply(d: DiagnosticResponse): string {
  const parts: string[] = [d.likely_issue_summary]
  if (d.safety_message) parts.push(d.safety_message)
  if (d.recommended_checks.length > 0) {
    parts.push('Recommended checks: ' + d.recommended_checks.join('; '))
  }
  if (d.note) parts.push(d.note)
  return parts.filter(Boolean).join('\n\n')
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

    const userContentParts: OpenAI.Chat.ChatCompletionContentPart[] = []
    if (message) {
      userContentParts.push({ type: 'text', text: message })
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

    const diagnostic = parseDiagnosticResponse(parsed)
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
