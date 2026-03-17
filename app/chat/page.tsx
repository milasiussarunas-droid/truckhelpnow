'use client'

import Image from 'next/image'
import Link from 'next/link'
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from 'react'
import { brandSeoEntries, faultSeoEntries } from '@/lib/diagnostics/seo-content'

type DetectedCodeItem = {
  raw_code: string
  normalized_code: string
  code_type: string
  confidence: 'low' | 'medium' | 'high'
  interpretation: string
}

type DiagnosticStructured = {
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

/** Minimal shape for optional knowledge context from the chat API (first-pass display). */
type KnowledgeContextShape = {
  matchedBrand?: { name?: string; slug?: string } | null
  matchedModules?: Array<{ code?: string; name?: string; subsystem?: string }>
  matchedCanonicalFaults?: Array<{ code?: string; title?: string; description?: string | null }>
  /** Ranked matches (preferred for display order); includes score, reasons, confidence. */
  rankedCanonicalFaults?: Array<{
    fault: { code?: string; title?: string; description?: string | null }
    score: number
    reasons: string[]
    confidence: 'low' | 'medium' | 'high'
  }>
  matchedProcedures?: Array<{ title?: string; audience?: string; summary?: string | null }>
  unresolvedCodes?: string[]
  confidenceNotes?: string[]
  evidenceSummary?: string[]
}

/** Message history entry. Same shape for text-only and image analysis: role + content always set; structured only when backend returns dashboard analysis. */
type ChatMsg = {
  role: 'user' | 'assistant'
  content: string
  structured?: DiagnosticStructured
  knowledgeContext?: KnowledgeContextShape | null
  attachmentName?: string
}

const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
const MAX_IMAGE_SIZE_BYTES = 8 * 1024 * 1024 // 8 MB

const WELCOME_MESSAGE =
  'Hi — tell me the truck year, make, model, engine, and what symptoms you have. If you have fault codes (SPN/FMI), paste them. You can also upload a photo of your dashboard or scan tool screen.'

const SUGGESTED_PROMPTS = [
  'Freightliner Cascadia losing power on hills with SPN 4364 FMI 18.',
  'Volvo VNL has intermittent air pressure warning after startup. What should I check first?',
  'Review this dashboard photo and tell me whether it is safe to keep driving.',
]

const CHECKLIST_ITEMS = [
  'Truck year, make, model, and engine',
  'What changed first: power, temperature, pressure, smoke, or noise',
  'Any SPN/FMI or OEM fault codes shown',
  'A clear photo of the dash or scanner if you have one',
]

const SAFETY_ITEMS = [
  'Brake, steering, overheating, fire risk, fuel leak, or low air pressure concerns should be treated as stop-now events.',
  'If warning lamps changed after a recent repair, include that context so the assistant can narrow likely causes faster.',
  'Photos work best when the full fault code area is sharp, bright, and free of glare.',
]

const chatFeaturedFaults = faultSeoEntries.slice(0, 3)

const CHAT_FAQS = [
  {
    question: 'What should I include in a truck diagnostic chat?',
    answer:
      'Start with the truck year, make, model, engine, the exact symptom, when it happens, and any SPN/FMI or OEM fault codes shown on the dash or scanner.',
  },
  {
    question: 'Can I use TruckHelpNow for dashboard photo analysis?',
    answer:
      'Yes. The chat accepts dashboard and scan-tool images so the assistant can pull visible text, fault codes, and warning-light context into the response.',
  },
  {
    question: 'When should a truck be parked instead of driven farther?',
    answer:
      'Brake issues, steering concerns, severe overheating, fire risk, fuel leaks, wheel-end issues, and low-air warnings should be treated as stop-now events until the truck is verified safe.',
  },
]

const chatJsonLd = [
  {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Truck Diagnostic Chat',
    description:
      'Interactive truck diagnostic chat for SPN/FMI fault codes, warning lights, and dashboard-photo analysis.',
    url: 'https://truckhelpnow.com/chat',
  },
  {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: 'https://truckhelpnow.com/',
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Truck Diagnostic Chat',
        item: 'https://truckhelpnow.com/chat',
      },
    ],
  },
  {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: CHAT_FAQS.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  },
]

function getImageValidationError(file: File): string | null {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return 'That image type isn\'t supported. Please use PNG, JPEG, or WebP.'
  }
  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return 'The image is too large. Maximum size is 8 MB. Please choose a smaller image.'
  }
  return null
}

function toFriendlyErrorMessage(backendError: string): string {
  if (backendError.includes('Invalid image type') || backendError.includes('image type')) {
    return 'That image type isn\'t supported. Please use PNG, JPEG, or WebP.'
  }
  if (backendError.includes('too large') || backendError.includes('Maximum size')) {
    return 'The image is too large. Maximum size is 8 MB. Please choose a smaller image.'
  }
  if (backendError.includes('message or image')) {
    return 'Please enter a message or attach an image.'
  }
  if (
    backendError.includes('Failed to create case') ||
    backendError.includes('Supabase') ||
    backendError.includes('fetch failed')
  ) {
    return 'Unable to start a case right now. Please try again in a moment.'
  }
  if (backendError.includes('OpenAI') || backendError.includes('API key')) {
    return 'Analysis is temporarily unavailable. Please try again later.'
  }
  return 'Analysis failed. Please try again or describe the issue in your message.'
}

function hasStructured(data: unknown): data is { structured: DiagnosticStructured } {
  if (data === null || typeof data !== 'object') return false
  const s = (data as Record<string, unknown>).structured
  if (s === null || typeof s !== 'object' || Array.isArray(s)) return false
  const o = s as Record<string, unknown>
  return (
    typeof o.most_likely_problem === 'string' &&
    Array.isArray(o.detected_codes) &&
    Array.isArray(o.warnings_detected) &&
    Array.isArray(o.recommended_checks_immediate) &&
    typeof o.safety_message === 'string'
  )
}

function hasKnowledgeContext(data: unknown): data is { knowledgeContext: KnowledgeContextShape } {
  if (data === null || typeof data !== 'object') return false
  const k = (data as Record<string, unknown>).knowledgeContext
  return k !== undefined && k !== null && typeof k === 'object' && !Array.isArray(k)
}

function getConfidenceClasses(level: 'low' | 'medium' | 'high') {
  if (level === 'high') {
    return 'border-emerald-400/30 bg-emerald-400/10 text-emerald-100'
  }
  if (level === 'medium') {
    return 'border-amber-400/30 bg-amber-400/10 text-amber-100'
  }
  return 'border-white/10 bg-white/5 text-slate-200'
}

function getSafetyClasses(level: 'low' | 'medium' | 'high') {
  if (level === 'high') {
    return {
      badge: 'border-red-400/30 bg-red-400/10 text-red-100',
      card: 'border-red-400/25 bg-red-400/10',
    }
  }
  if (level === 'medium') {
    return {
      badge: 'border-amber-400/30 bg-amber-400/10 text-amber-100',
      card: 'border-amber-400/20 bg-amber-400/10',
    }
  }
  return {
    badge: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-100',
    card: 'border-emerald-400/20 bg-emerald-400/10',
  }
}

function getDriveStatusClasses(status: 'yes' | 'maybe' | 'no') {
  if (status === 'no') {
    return 'border-red-400/30 bg-red-400/10 text-red-100'
  }
  if (status === 'maybe') {
    return 'border-amber-400/30 bg-amber-400/10 text-amber-100'
  }
  return 'border-emerald-400/30 bg-emerald-400/10 text-emerald-100'
}

function MetaBadge({
  label,
  value,
  className,
}: {
  label: string
  value: string
  className: string
}) {
  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[0.7rem] font-medium uppercase tracking-[0.18em] ${className}`}
    >
      <span className="text-slate-400">{label}</span>
      <span>{value}</span>
    </div>
  )
}

/** Renders a section only when there is content; avoids empty noisy sections. */
function Section({
  label,
  value,
}: {
  label: string
  value: string | string[]
}) {
  if (Array.isArray(value)) {
    if (value.length === 0) return null
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <div className="mb-2 text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-slate-400">
          {label}
        </div>
        <ul className="space-y-2 text-sm leading-6 text-slate-100">
          {value.map((item, i) => (
            <li key={i} className="flex gap-2">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-300" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    )
  }

  if (!value || !String(value).trim()) return null

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="mb-2 text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-slate-400">
        {label}
      </div>
      <div className="whitespace-pre-wrap text-sm leading-6 text-slate-100">{value}</div>
    </div>
  )
}

function StructuredAnalysisBlock({
  structured,
  summary,
}: {
  structured: DiagnosticStructured
  summary: string
}) {
  const safetyTone = getSafetyClasses(structured.safety_level)

  return (
    <div className="space-y-4 text-slate-100">
      {summary ? (
        <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
          <div className="mb-2 text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-slate-400">
            Assessment summary
          </div>
          <p className="whitespace-pre-wrap text-sm leading-6 text-slate-100">{summary}</p>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <MetaBadge
          label="Safety"
          value={structured.safety_level}
          className={safetyTone.badge}
        />
        <MetaBadge
          label="Confidence"
          value={structured.overall_confidence}
          className={getConfidenceClasses(structured.overall_confidence)}
        />
        <MetaBadge
          label="Driver status"
          value={structured.can_driver_continue}
          className={getDriveStatusClasses(structured.can_driver_continue)}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Section label="Most likely problem" value={structured.most_likely_problem} />
        <Section label="Primary systems involved" value={structured.primary_systems_involved} />
        <Section label="Possible causes" value={structured.possible_causes} />
        <Section label="Immediate checks" value={structured.recommended_checks_immediate} />
        <Section label="Shop-level checks" value={structured.recommended_checks_shop_level} />
        <Section label="Driver guidance" value={structured.driver_guidance} />
        <Section label="Mechanic guidance" value={structured.mechanic_guidance} />
        <Section label="Missing information" value={structured.missing_information} />
        <Section label="Warning lights" value={structured.warnings_detected} />
        <Section label="Fault timestamps" value={structured.fault_timestamps} />
        <Section label="Fault pattern" value={structured.fault_pattern} />
        <Section label="Visible text" value={structured.visible_text} />
        <Section
          label="Uncertain or unreadable text"
          value={structured.uncertain_text}
        />
      </div>

      {structured.detected_codes.length > 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="mb-3 text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-slate-400">
            Detected codes
          </div>
          <div className="space-y-3">
            {structured.detected_codes.map((code, i) => (
              <div
                key={i}
                className="rounded-2xl border border-white/10 bg-slate-950/60 p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 font-mono text-sm font-semibold text-slate-50">
                    {code.raw_code}
                  </span>
                  {code.normalized_code && code.normalized_code !== code.raw_code ? (
                    <span className="font-mono text-xs text-slate-400">
                      normalized {code.normalized_code}
                    </span>
                  ) : null}
                  {code.code_type ? (
                    <span className="text-xs uppercase tracking-[0.16em] text-slate-500">
                      {code.code_type}
                    </span>
                  ) : null}
                  <span
                    className={`ml-auto rounded-full border px-2.5 py-1 text-[0.68rem] font-medium uppercase tracking-[0.18em] ${getConfidenceClasses(code.confidence)}`}
                  >
                    {code.confidence}
                  </span>
                </div>
                {code.interpretation ? (
                  <p className="mt-3 text-sm leading-6 text-slate-200">
                    {code.interpretation}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {(structured.safety_message || structured.safety_level) ? (
        <div className={`rounded-2xl border p-4 ${safetyTone.card}`} role="alert">
          <div className="mb-2 text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-slate-100/80">
            Safety guidance
          </div>
          {structured.safety_message ? (
            <p className="text-sm leading-6 text-slate-50">{structured.safety_message}</p>
          ) : null}
          <p className="mt-3 text-xs text-slate-200/80">
            AI guidance only. Verify safety-critical warnings before driving.
          </p>
        </div>
      ) : null}
    </div>
  )
}

/** Compact knowledge-base section; only renders when context exists and has at least one useful section. */
function KnowledgeContextBlock({ context }: { context: KnowledgeContextShape }) {
  const hasBrand = context.matchedBrand && (context.matchedBrand.name ?? context.matchedBrand.slug)
  const hasModules = context.matchedModules && context.matchedModules.length > 0
  const ranked = context.rankedCanonicalFaults ?? []
  const flatFaults = context.matchedCanonicalFaults ?? []
  const hasFaults = ranked.length > 0 || flatFaults.length > 0
  const hasProcedures = context.matchedProcedures && context.matchedProcedures.length > 0
  const hasUnresolved = context.unresolvedCodes && context.unresolvedCodes.length > 0
  const hasConfidence = context.confidenceNotes && context.confidenceNotes.length > 0
  const hasSummary = context.evidenceSummary && context.evidenceSummary.length > 0

  const topRanked = ranked.slice(0, 3)
  const showRanked = topRanked.length > 0
  const topTwoClose =
    showRanked && topRanked.length >= 2 && topRanked[0].score - topRanked[1].score <= 8

  if (
    !hasBrand &&
    !hasModules &&
    !hasFaults &&
    !hasProcedures &&
    !hasUnresolved &&
    !hasConfidence &&
    !hasSummary
  ) {
    return null
  }

  return (
    <div className="rounded-2xl border border-sky-400/20 bg-sky-400/10 p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-sky-400/25 bg-sky-400/10 px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-sky-100">
          Supporting evidence
        </span>
        <span className="text-xs text-sky-100/80">
          Context pulled from the diagnostic knowledge base
        </span>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {hasBrand ? (
          <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
            <div className="mb-2 text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-sky-100/80">
              Brand
            </div>
            <div className="text-sm text-slate-50">
              {context.matchedBrand!.name ?? context.matchedBrand!.slug}
            </div>
          </div>
        ) : null}

        {hasModules ? (
          <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
            <div className="mb-2 text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-sky-100/80">
              ECU modules
            </div>
            <div className="flex flex-wrap gap-2">
              {context.matchedModules!
                .map((module) => module.code ?? module.name)
                .filter(Boolean)
                .map((module) => (
                  <span
                    key={module}
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-100"
                  >
                    {module}
                  </span>
                ))}
            </div>
          </div>
        ) : null}
      </div>

      {hasFaults ? (
        <div className="mt-3 rounded-2xl border border-white/10 bg-slate-950/35 p-4">
          <div className="mb-3 text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-sky-100/80">
            Matched faults{showRanked ? ' by relevance' : ''}
          </div>
          <div className="space-y-3">
            {showRanked
              ? topRanked.map((rankedFault, i) => (
                  <div
                    key={i}
                    className="rounded-2xl border border-white/10 bg-white/[0.03] p-3"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-semibold text-slate-50">
                        {rankedFault.fault.code ?? '—'}
                      </span>
                      {rankedFault.fault.title ? (
                        <span className="text-sm text-slate-200">
                          {rankedFault.fault.title}
                        </span>
                      ) : null}
                      <span
                        className={`ml-auto rounded-full border px-2.5 py-1 text-[0.68rem] font-medium uppercase tracking-[0.18em] ${getConfidenceClasses(rankedFault.confidence)}`}
                      >
                        {rankedFault.confidence}
                      </span>
                    </div>
                    {rankedFault.reasons.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {rankedFault.reasons.slice(0, 3).map((reason) => (
                          <span
                            key={reason}
                            className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-slate-200"
                          >
                            {reason}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))
              : flatFaults.map((fault, i) => (
                  <div
                    key={i}
                    className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-sm text-slate-100"
                  >
                    <span className="font-mono font-semibold">{fault.code ?? '—'}</span>
                    {fault.title ? <span className="text-slate-300"> — {fault.title}</span> : null}
                  </div>
                ))}
          </div>
          {showRanked && ranked.length > 3 ? (
            <p className="mt-3 text-xs text-slate-300">+{ranked.length - 3} more relevant fault matches available.</p>
          ) : null}
          {topTwoClose ? (
            <p className="mt-2 text-xs text-amber-100">
              Top matches are close. Consider multiple candidate causes before replacing parts.
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        {hasProcedures ? (
          <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
            <div className="mb-2 text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-sky-100/80">
              Suggested procedures
            </div>
            <ul className="space-y-2 text-sm text-slate-100">
              {context.matchedProcedures!.map((procedure, i) => (
                <li key={i} className="flex gap-2">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-300" />
                  <span>{procedure.title ?? '—'}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {hasUnresolved ? (
          <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
            <div className="mb-2 text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-sky-100/80">
              Unresolved codes
            </div>
            <div className="flex flex-wrap gap-2">
              {context.unresolvedCodes!.map((code) => (
                <span
                  key={code}
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-1 font-mono text-xs text-slate-100"
                >
                  {code}
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {(hasConfidence || hasSummary) ? (
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          {hasConfidence ? (
            <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
              <div className="mb-2 text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-sky-100/80">
                Confidence notes
              </div>
              <ul className="space-y-2 text-sm text-slate-100">
                {context.confidenceNotes!.map((note, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-300" />
                    <span>{note}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {hasSummary ? (
            <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
              <div className="mb-2 text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-sky-100/80">
                Evidence summary
              </div>
              <ul className="space-y-2 text-sm text-slate-100">
                {context.evidenceSummary!.map((summary, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-300" />
                    <span>{summary}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

export default function ChatPage() {
  const [caseId, setCaseId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [imageError, setImageError] = useState<string | null>(null)
  const [chatError, setChatError] = useState<string | null>(null)
  const [loadingMessage, setLoadingMessage] = useState<string>('Thinking…')
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const previewUrlRef = useRef<string | null>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = '0px'
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`
  }, [input])

  // Revoke object URL on unmount to avoid memory leaks
  useEffect(() => {
    return () => {
      const url = previewUrlRef.current
      if (url) {
        URL.revokeObjectURL(url)
        previewUrlRef.current = null
      }
    }
  }, [])

  function revokePreviewUrl() {
    const url = previewUrlRef.current
    if (url) {
      URL.revokeObjectURL(url)
      previewUrlRef.current = null
    }
  }

  function clearSelectedImage() {
    setImageError(null)
    revokePreviewUrl()
    setPreviewUrl(null)
    setSelectedFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function resetChat() {
    setCaseId(null)
    setMessages([])
    setInput('')
    setChatError(null)
    clearSelectedImage()
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null
    setChatError(null)

    if (file) {
      setImageError(getImageValidationError(file) ?? null)
      revokePreviewUrl()
      const newUrl = URL.createObjectURL(file)
      previewUrlRef.current = newUrl
      setPreviewUrl(newUrl)
      setSelectedFile(file)
      return
    }

    clearSelectedImage()
  }

  async function createCase() {
    const res = await fetch('/api/cases', { method: 'POST' })
    const data = await res.json().catch(() => null)

    if (!res.ok || !data?.caseId) {
      throw new Error(
        typeof data?.error === 'string' ? data.error : 'Failed to create case'
      )
    }

    return data.caseId as string
  }

  async function startNewCase() {
    setLoading(true)
    setChatError(null)

    try {
      const nextCaseId = await createCase()
      setCaseId(nextCaseId)
      setMessages([{ role: 'assistant', content: WELCOME_MESSAGE }])
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : 'Unknown error'
      setChatError(toFriendlyErrorMessage(errMsg))
    } finally {
      setLoading(false)
    }
  }

  async function send() {
    const text = input.trim()
    const attachedFile = selectedFile

    if ((!text && !attachedFile) || loading) return

    if (attachedFile) {
      const fileError = getImageValidationError(attachedFile)
      if (fileError) {
        setImageError(fileError)
        return
      }
    }

    setImageError(null)
    setChatError(null)

    let cid = caseId

    try {
      if (!cid) {
        cid = await createCase()
        setCaseId(cid)
      }

      setInput('')
      setMessages((currentMessages) => [
        ...currentMessages,
        {
          role: 'user',
          content: text || 'Please analyze the attached dashboard image.',
          attachmentName: attachedFile?.name,
        },
      ])
      setLoadingMessage(attachedFile ? 'Analyzing dashboard image…' : 'Thinking…')
      setLoading(true)

      clearSelectedImage()

      const formData = new FormData()
      formData.append('message', text)
      formData.append('caseId', cid)
      if (attachedFile) {
        formData.append('image', attachedFile)
      }

      const res = await fetch('/api/chat', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Chat failed')

      const reply = typeof data.reply === 'string' ? data.reply : ''
      const structured = hasStructured(data) ? data.structured : undefined
      const knowledgeContext = hasKnowledgeContext(data) ? data.knowledgeContext : undefined
      const content =
        reply ||
        (structured
          ? `${structured.most_likely_problem || 'Analysis complete.'}${structured.safety_message ? ` ${structured.safety_message}` : ''}`.trim()
          : '')

      setMessages((currentMessages) => [
        ...currentMessages,
        {
          role: 'assistant',
          content: content || 'Diagnostic analysis complete.',
          structured,
          knowledgeContext: knowledgeContext ?? null,
        },
      ])
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : 'Unknown error'
      const friendlyMsg = toFriendlyErrorMessage(errMsg)
      setMessages((currentMessages) => [
        ...currentMessages,
        { role: 'assistant', content: friendlyMsg },
      ])
    } finally {
      setLoading(false)
    }
  }

  function handleComposerKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void send()
    }
  }

  const canSend = !loading && (input.trim().length > 0 || Boolean(selectedFile))

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.16),_transparent_28%),linear-gradient(180deg,_rgba(2,6,23,0.98)_0%,_rgba(2,6,23,1)_100%)]">
      {chatJsonLd.map((entry, index) => (
        <script
          key={index}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(entry) }}
        />
      ))}
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
        <header className="rounded-[28px] border border-white/10 bg-slate-950/80 p-5 shadow-[0_24px_80px_rgba(2,6,23,0.45)] backdrop-blur-xl">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-start gap-4">
              <Link
                href="/"
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-emerald-400/30 bg-emerald-400/10 text-sm font-semibold text-emerald-100 shadow-inner shadow-emerald-400/10 transition hover:border-emerald-300/50 hover:bg-emerald-400/20"
                aria-label="Go to TruckHelpNow home"
              >
                TH
              </Link>
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href="/" className="text-sm font-semibold tracking-tight text-white transition hover:text-emerald-200">
                    TruckHelpNow
                  </Link>
                  <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[0.68rem] font-medium uppercase tracking-[0.18em] text-slate-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    AI diagnostic workspace
                  </span>
                </div>
                <div>
                  <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                    Professional truck diagnostics with clearer next steps.
                  </h1>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300 sm:text-base">
                    Describe symptoms, paste SPN/FMI fault codes, or upload a dashboard
                    photo to get structured, safety-first guidance that is easy to scan
                    from the cab or the shop floor.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 xl:items-end">
              <nav aria-label="Chat page navigation" className="flex flex-wrap gap-2 xl:justify-end">
                <Link
                  href="/fault-codes"
                  className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-100 transition hover:border-white/20 hover:bg-white/10"
                >
                  Fault codes
                </Link>
                <Link
                  href="/brands"
                  className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-100 transition hover:border-white/20 hover:bg-white/10"
                >
                  Brands
                </Link>
                <Link
                  href="/"
                  className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-100 transition hover:border-white/20 hover:bg-white/10"
                >
                  Home
                </Link>
              </nav>

              <div className="flex flex-wrap items-center gap-2 xl:justify-end">
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[0.68rem] font-medium uppercase tracking-[0.18em] text-slate-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  {caseId ? 'Case active' : 'Ready to start'}
                </span>
                <span className="inline-flex items-center rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-[0.68rem] font-medium uppercase tracking-[0.18em] text-emerald-100">
                  Image-aware
                </span>
                <button
                  type="button"
                  onClick={resetChat}
                  className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-100 transition hover:border-white/20 hover:bg-white/10"
                >
                  New chat
                </button>
              </div>
            </div>
          </div>
        </header>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <section className="overflow-hidden rounded-[30px] border border-white/10 bg-slate-950/80 shadow-[0_24px_80px_rgba(2,6,23,0.45)] backdrop-blur-xl">
            <div className="border-b border-white/10 px-4 py-4 sm:px-6">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-slate-500">
                    Diagnostic session
                  </p>
                  <p className="mt-1 text-sm text-slate-300">
                    {messages.length > 0
                      ? 'Messages are grouped for quick scan review, with structured evidence and safety guidance kept in-line.'
                      : 'Start with a clear symptom summary, the truck details, or a dashboard photo.'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 text-[0.68rem] font-medium uppercase tracking-[0.18em] text-slate-400">
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                    Mobile ready
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                    Structured guidance
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                    Safety first
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-4 px-4 py-5 sm:px-6 sm:py-6">
              {chatError ? (
                <div
                  className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-50"
                  role="alert"
                >
                  {chatError}
                </div>
              ) : null}

              {!caseId && messages.length === 0 ? (
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
                  <div className="rounded-[28px] border border-white/10 bg-gradient-to-br from-white/[0.05] to-white/[0.02] p-5 sm:p-6">
                    <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-[0.68rem] font-medium uppercase tracking-[0.18em] text-emerald-100">
                      Start a case
                    </div>
                    <h2 className="mt-4 text-2xl font-semibold tracking-tight text-white">
                      Built for practical roadside troubleshooting.
                    </h2>
                    <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
                      Capture the truck details, what changed, and any fault codes or
                      dash warnings. The assistant will turn that into likely systems,
                      low-risk checks, and safety-minded next steps.
                    </p>

                    <div className="mt-6 grid gap-3 md:grid-cols-3">
                      <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
                        <p className="text-sm font-semibold text-white">Symptoms</p>
                        <p className="mt-2 text-sm leading-6 text-slate-300">
                          Describe when the issue shows up: startup, idle, under load,
                          regen, or highway speed.
                        </p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
                        <p className="text-sm font-semibold text-white">Codes</p>
                        <p className="mt-2 text-sm leading-6 text-slate-300">
                          Paste SPN/FMI or OEM fault codes so the assistant can anchor the
                          diagnosis faster.
                        </p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
                        <p className="text-sm font-semibold text-white">Photos</p>
                        <p className="mt-2 text-sm leading-6 text-slate-300">
                          Upload a dashboard or scanner image if warning lights or code
                          details are easier to show than type.
                        </p>
                      </div>
                    </div>

                    <div className="mt-6">
                      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-slate-500">
                        Suggested prompts
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {SUGGESTED_PROMPTS.map((prompt) => (
                          <button
                            key={prompt}
                            type="button"
                            onClick={() => {
                              setInput(prompt)
                              setChatError(null)
                              textareaRef.current?.focus()
                            }}
                            className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-left text-sm text-slate-100 transition hover:border-white/20 hover:bg-white/10"
                          >
                            {prompt}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
                      <button
                        type="button"
                        onClick={() => void startNewCase()}
                        disabled={loading}
                        className="inline-flex items-center justify-center rounded-full bg-emerald-400 px-5 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-500/25 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {loading ? 'Starting…' : 'Start diagnostic session'}
                      </button>
                      <p className="text-sm text-slate-400">
                        Or type below and your first message will create the case
                        automatically.
                      </p>
                    </div>
                  </div>

                  <div className="rounded-[28px] border border-white/10 bg-slate-950/55 p-5">
                    <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-slate-500">
                      What you will get
                    </p>
                    <div className="mt-4 space-y-3">
                      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                        <p className="text-sm font-semibold text-white">Likely system area</p>
                        <p className="mt-2 text-sm leading-6 text-slate-300">
                          A clear read on what subsystem the symptoms point toward first.
                        </p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                        <p className="text-sm font-semibold text-white">Immediate checks</p>
                        <p className="mt-2 text-sm leading-6 text-slate-300">
                          Low-risk inspection steps drivers or dispatch can use right away.
                        </p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                        <p className="text-sm font-semibold text-white">Safety guidance</p>
                        <p className="mt-2 text-sm leading-6 text-slate-300">
                          Stronger stop-driving guidance when the symptoms suggest higher risk.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((message, idx) => {
                    const isUser = message.role === 'user'

                    return (
                      <article
                        key={idx}
                        className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`w-full rounded-[28px] border p-4 sm:p-5 ${
                            isUser
                              ? 'max-w-2xl border-emerald-400/20 bg-emerald-400/10'
                              : 'max-w-4xl border-white/10 bg-white/[0.04]'
                          }`}
                        >
                          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                            <div className="flex items-start gap-3">
                              <div
                                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-xs font-semibold ${
                                  isUser
                                    ? 'bg-emerald-300 text-slate-950'
                                    : 'border border-white/10 bg-white/5 text-slate-100'
                                }`}
                              >
                                {isUser ? 'You' : 'TH'}
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-white">
                                  {isUser ? 'Driver input' : 'TruckHelpNow'}
                                </p>
                                <p className="mt-1 text-[0.68rem] font-medium uppercase tracking-[0.2em] text-slate-500">
                                  {isUser
                                    ? 'Submitted context'
                                    : message.structured
                                      ? 'Structured diagnostic analysis'
                                      : 'Assistant guidance'}
                                </p>
                              </div>
                            </div>

                            {!isUser && message.structured ? (
                              <div className="flex flex-wrap gap-2">
                                <MetaBadge
                                  label="Safety"
                                  value={message.structured.safety_level}
                                  className={getSafetyClasses(message.structured.safety_level).badge}
                                />
                                <MetaBadge
                                  label="Confidence"
                                  value={message.structured.overall_confidence}
                                  className={getConfidenceClasses(message.structured.overall_confidence)}
                                />
                              </div>
                            ) : null}
                          </div>

                          {message.role === 'assistant' && message.structured ? (
                            <div className="space-y-4">
                              <StructuredAnalysisBlock
                                structured={message.structured}
                                summary={message.content}
                              />
                              {message.knowledgeContext ? (
                                <KnowledgeContextBlock context={message.knowledgeContext} />
                              ) : null}
                            </div>
                          ) : (
                            <div className="space-y-3">
                              <div className="whitespace-pre-wrap text-sm leading-7 text-slate-100">
                                {message.content}
                              </div>
                              {message.attachmentName ? (
                                <div className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
                                  Image attached: {message.attachmentName}
                                </div>
                              ) : null}
                            </div>
                          )}
                        </div>
                      </article>
                    )
                  })}

                  {loading ? (
                    <div className="flex justify-start">
                      <div className="w-full max-w-3xl rounded-[28px] border border-white/10 bg-white/[0.04] p-4 sm:p-5">
                        <div className="mb-3 flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-xs font-semibold text-slate-100">
                            TH
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-white">TruckHelpNow</p>
                            <p className="mt-1 text-[0.68rem] font-medium uppercase tracking-[0.2em] text-slate-500">
                              Working
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 text-sm text-slate-300">
                          <div className="flex gap-1">
                            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
                            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400 [animation-delay:120ms]" />
                            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400 [animation-delay:240ms]" />
                          </div>
                          <span>{loadingMessage}</span>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  <div ref={bottomRef} />
                </div>
              )}
            </div>

            <div className="border-t border-white/10 bg-slate-950/85 px-4 py-4 sm:px-6 sm:py-5">
              <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-3 shadow-[0_18px_40px_rgba(2,6,23,0.3)]">
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-3 px-1">
                    <div>
                      <p className="text-sm font-semibold text-white">Describe the problem</p>
                      <p className="mt-1 text-xs text-slate-400">
                        Include truck details, symptoms, codes, or upload a dash/scanner image.
                      </p>
                    </div>
                    <label
                      htmlFor="chat-image-input"
                      className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-slate-100 transition hover:border-white/20 hover:bg-white/10"
                    >
                      <span className="text-base leading-none">+</span>
                      Attach image
                    </label>
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png, image/jpeg, image/jpg, image/webp"
                    onChange={handleFileChange}
                    className="hidden"
                    id="chat-image-input"
                    aria-label="Select image for upload"
                  />

                  <div className="rounded-[24px] border border-white/10 bg-slate-950/70 p-2">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
                      <textarea
                        ref={textareaRef}
                        value={input}
                        onChange={(e) => {
                          setInput(e.target.value)
                          setChatError(null)
                        }}
                        onKeyDown={handleComposerKeyDown}
                        placeholder="Ex: 2019 Cascadia DD15. Low power uphill, check engine light, SPN 4364 FMI 18. Any safe checks before I drive farther?"
                        rows={1}
                        className="min-h-[88px] w-full resize-none bg-transparent px-3 py-3 text-sm leading-6 text-slate-100 outline-none placeholder:text-slate-500"
                      />

                      <div className="flex items-center gap-2 px-1 pb-1 lg:pb-2">
                        <button
                          type="button"
                          onClick={() => void send()}
                          disabled={!canSend}
                          className="inline-flex h-12 items-center justify-center rounded-2xl bg-emerald-400 px-5 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Send
                        </button>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-col gap-3 border-t border-white/10 px-3 pt-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[0.68rem] font-medium uppercase tracking-[0.18em] text-slate-400">
                          Enter to send
                        </span>
                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[0.68rem] font-medium uppercase tracking-[0.18em] text-slate-400">
                          Shift + Enter for a new line
                        </span>
                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[0.68rem] font-medium uppercase tracking-[0.18em] text-slate-400">
                          PNG, JPG, WebP up to 8 MB
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">
                        Safety-critical issues should still be confirmed with a qualified technician.
                      </p>
                    </div>
                  </div>

                  {previewUrl ? (
                    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/60 p-3">
                      <Image
                        src={previewUrl}
                        alt="Preview of selected upload"
                        width={64}
                        height={64}
                        unoptimized
                        className="h-16 w-16 rounded-2xl border border-white/10 object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-white">
                          {selectedFile?.name ?? 'Selected image'}
                        </p>
                        <p className="mt-1 text-xs text-slate-400">
                          Keep warning lights and fault codes fully visible for better results.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={clearSelectedImage}
                        className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-slate-100 transition hover:border-white/20 hover:bg-white/10"
                        aria-label="Remove selected image"
                      >
                        Remove
                      </button>
                    </div>
                  ) : null}

                  {imageError ? (
                    <p className="text-xs text-red-300" role="alert">
                      {imageError}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          </section>

          <aside className="space-y-4 xl:sticky xl:top-6 xl:self-start">
            <div className="rounded-[28px] border border-white/10 bg-slate-950/80 p-5 shadow-[0_24px_80px_rgba(2,6,23,0.45)] backdrop-blur-xl">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-slate-500">
                Best results
              </p>
              <h2 className="mt-3 text-lg font-semibold text-white">
                Share the details that change the diagnosis.
              </h2>
              <ul className="mt-4 space-y-3">
                {CHECKLIST_ITEMS.map((item) => (
                  <li key={item} className="flex gap-3 text-sm leading-6 text-slate-300">
                    <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-[28px] border border-white/10 bg-slate-950/80 p-5 shadow-[0_24px_80px_rgba(2,6,23,0.45)] backdrop-blur-xl">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-slate-500">
                Safety reminders
              </p>
              <div className="mt-4 space-y-3">
                {SAFETY_ITEMS.map((item) => (
                  <div
                    key={item}
                    className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm leading-6 text-slate-300"
                  >
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[28px] border border-emerald-400/15 bg-emerald-400/10 p-5 shadow-[0_24px_80px_rgba(2,6,23,0.45)] backdrop-blur-xl">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-emerald-100/80">
                Guidance scope
              </p>
              <p className="mt-3 text-sm leading-6 text-emerald-50">
                TruckHelpNow is designed to prioritize low-risk checks first and flag
                higher-risk conditions clearly. It does not replace certified diagnostics
                or OEM service procedures.
              </p>
            </div>
          </aside>
        </div>

        <section aria-labelledby="chat-topics" className="rounded-[28px] border border-white/10 bg-slate-950/75 p-5 shadow-[0_24px_80px_rgba(2,6,23,0.45)] backdrop-blur-xl sm:p-6">
          <div className="max-w-3xl">
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-slate-500">
              What this page covers
            </p>
            <h2 id="chat-topics" className="mt-3 text-2xl font-semibold tracking-tight text-white">
              Use the chat for truck fault codes, warning lights, and symptom-based troubleshooting
            </h2>
            <p className="mt-3 text-sm leading-7 text-slate-300 sm:text-base">
              This page is built for real truck-diagnostic searches like truck fault code help, semi-truck warning light questions, and commercial truck troubleshooting when the issue still needs fast context before a shop visit.
            </p>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {chatFeaturedFaults.map((fault) => (
              <article key={fault.code} className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-emerald-200/80">
                  {fault.severityLabel}
                </p>
                <h3 className="mt-3 text-lg font-semibold text-white">{fault.code}</h3>
                <p className="mt-2 text-sm text-emerald-300">{fault.title}</p>
                <p className="mt-3 text-sm leading-6 text-slate-300">{fault.description}</p>
                <Link
                  href={fault.href}
                  className="mt-4 inline-flex text-sm font-medium text-emerald-300 transition hover:text-emerald-200"
                >
                  View fault details
                </Link>
              </article>
            ))}
          </div>
        </section>

        <section aria-labelledby="supported-brands" className="rounded-[28px] border border-white/10 bg-slate-950/75 p-5 shadow-[0_24px_80px_rgba(2,6,23,0.45)] backdrop-blur-xl sm:p-6">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
            <div>
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-slate-500">
                Supported entry pages
              </p>
              <h2 id="supported-brands" className="mt-3 text-2xl font-semibold tracking-tight text-white">
                Brand pages for common heavy-truck diagnostic searches
              </h2>
              <p className="mt-3 text-sm leading-7 text-slate-300 sm:text-base">
                TruckHelpNow also publishes focused brand pages for common search intent around Volvo, Freightliner, Kenworth, and International truck diagnostics.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                {brandSeoEntries.map((brand) => (
                  <Link
                    key={brand.slug}
                    href={brand.href}
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 transition hover:border-white/20 hover:bg-white/10"
                  >
                    {brand.name}
                  </Link>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-slate-500">
                Best SEO use of this tool
              </p>
              <ul className="mt-4 space-y-3">
                <li className="flex gap-3 text-sm leading-6 text-slate-300">
                  <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
                  <span>Paste the exact fault code instead of only describing a light.</span>
                </li>
                <li className="flex gap-3 text-sm leading-6 text-slate-300">
                  <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
                  <span>Include when the symptom appears: startup, idle, regen, hill load, or highway speed.</span>
                </li>
                <li className="flex gap-3 text-sm leading-6 text-slate-300">
                  <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
                  <span>Upload a dashboard or scan-tool image when the code is easier to show than type.</span>
                </li>
              </ul>
            </div>
          </div>
        </section>

        <section aria-labelledby="chat-faq" className="rounded-[28px] border border-white/10 bg-slate-950/75 p-5 shadow-[0_24px_80px_rgba(2,6,23,0.45)] backdrop-blur-xl sm:p-6">
          <div className="max-w-3xl">
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-slate-500">
              FAQ
            </p>
            <h2 id="chat-faq" className="mt-3 text-2xl font-semibold tracking-tight text-white">
              Questions drivers ask before opening a truck diagnostic chat
            </h2>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {CHAT_FAQS.map((faq) => (
              <article key={faq.question} className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                <h3 className="text-base font-semibold text-white">{faq.question}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-300">{faq.answer}</p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}