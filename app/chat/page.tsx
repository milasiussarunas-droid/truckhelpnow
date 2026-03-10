'use client'

import { useEffect, useRef, useState } from 'react'

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
}

const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
const MAX_IMAGE_SIZE_BYTES = 8 * 1024 * 1024 // 8 MB

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
      <div className="mb-3 last:mb-0">
        <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
          {label}
        </div>
        <ul className="list-disc list-inside text-gray-900 space-y-0.5 text-sm">
          {value.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      </div>
    )
  }
  if (!value || !String(value).trim()) return null
  return (
    <div className="mb-3 last:mb-0">
      <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
        {label}
      </div>
      <div className="text-gray-900 text-sm whitespace-pre-wrap">{value}</div>
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
  const safetyClass =
    structured.safety_level === 'high'
      ? 'border-amber-300 bg-amber-50'
      : structured.safety_level === 'medium'
        ? 'border-yellow-200 bg-yellow-50'
        : 'border-gray-200 bg-gray-50'

  return (
    <div className="space-y-3 text-gray-900">
      {summary ? (
        <div className="whitespace-pre-wrap text-sm mb-3 pb-3 border-b border-gray-200">
          {summary}
        </div>
      ) : null}

      <Section label="Visible text" value={structured.visible_text} />
      <Section label="Uncertain / unreadable text" value={structured.uncertain_text} />

      {structured.detected_codes.length > 0 ? (
        <div className="mb-3 last:mb-0">
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
            Detected codes
          </div>
          <div className="space-y-2">
            {structured.detected_codes.map((code, i) => (
              <div
                key={i}
                className="rounded-lg border border-gray-200 bg-white p-2.5 shadow-sm"
              >
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span className="font-mono text-sm font-semibold text-gray-900">
                    {code.raw_code}
                  </span>
                  {code.normalized_code && code.normalized_code !== code.raw_code && (
                    <span className="font-mono text-xs text-gray-600">
                      → {code.normalized_code}
                    </span>
                  )}
                  {code.code_type ? (
                    <span className="text-xs text-gray-500">({code.code_type})</span>
                  ) : null}
                  <span className="text-xs text-gray-400 ml-auto">Confidence: {code.confidence}</span>
                </div>
                {code.interpretation ? (
                  <p className="text-sm text-gray-700 mt-1.5 leading-snug">
                    {code.interpretation}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <Section label="Warning lights" value={structured.warnings_detected} />
      <Section label="Fault timestamps" value={structured.fault_timestamps} />
      <Section label="Fault pattern" value={structured.fault_pattern} />
      <Section label="Primary systems involved" value={structured.primary_systems_involved} />
      <Section label="Most likely problem" value={structured.most_likely_problem} />
      <Section label="Possible causes" value={structured.possible_causes} />
      <Section label="Immediate checks" value={structured.recommended_checks_immediate} />
      <Section label="Shop-level checks" value={structured.recommended_checks_shop_level} />
      <Section label="Driver guidance" value={structured.driver_guidance} />
      <Section label="Mechanic guidance" value={structured.mechanic_guidance} />
      <Section label="Missing information" value={structured.missing_information} />

      {(structured.safety_message || structured.safety_level) ? (
        <div
          className={`rounded-lg border p-3 ${safetyClass}`}
          role="alert"
        >
          <div className="text-xs font-medium text-gray-600 uppercase tracking-wide mb-1">
            Safety
          </div>
          {structured.safety_message ? (
            <div className="text-sm">{structured.safety_message}</div>
          ) : null}
          {structured.can_driver_continue ? (
            <p className="text-xs text-gray-600 mt-1.5">
              Can driver continue: {structured.can_driver_continue}
            </p>
          ) : null}
        </div>
      ) : null}

      {structured.overall_confidence ? (
        <div className="text-xs text-gray-500">
          <span className="font-medium uppercase tracking-wide">Overall confidence:</span>{' '}
          {structured.overall_confidence}
        </div>
      ) : null}

      <p className="text-xs text-gray-500 pt-2 border-t border-gray-200">
        AI analysis is guidance only. Verify safety-critical warnings before driving.
      </p>
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
  const topTwoClose = showRanked && topRanked.length >= 2 && (topRanked[0].score - topRanked[1].score) <= 8

  if (!hasBrand && !hasModules && !hasFaults && !hasProcedures && !hasUnresolved && !hasConfidence && !hasSummary) {
    return null
  }

  return (
    <div className="mt-3 pt-3 border-t border-gray-200">
      <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
        From knowledge base
      </div>
      <div className="space-y-2 text-sm text-gray-700">
        {hasBrand && (
          <div>
            <span className="text-gray-500">Brand: </span>
            {context.matchedBrand!.name ?? context.matchedBrand!.slug}
          </div>
        )}
        {hasModules && (
          <div>
            <span className="text-gray-500">ECU modules: </span>
            {context.matchedModules!.map((m) => m.code ?? m.name).filter(Boolean).join(', ') || '—'}
          </div>
        )}
        {hasFaults && (
          <div>
            <span className="text-gray-500">Matched faults{showRanked ? ' (by relevance)' : ''}: </span>
            <ul className="list-disc list-inside mt-0.5 space-y-1">
              {showRanked
                ? topRanked.map((r, i) => (
                    <li key={i} className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                      <span className="font-mono">{r.fault.code ?? '—'}</span>
                      {r.fault.title ? <span>— {r.fault.title}</span> : null}
                      <span className="inline-flex items-center gap-1 flex-wrap">
                        <span className={`text-xs px-1.5 py-0.5 rounded ${r.confidence === 'high' ? 'bg-emerald-100 text-emerald-800' : r.confidence === 'medium' ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-600'}`}>
                          {r.confidence}
                        </span>
                        {r.reasons.slice(0, 2).map((reason, j) => (
                          <span key={j} className="text-xs text-gray-500">· {reason}</span>
                        ))}
                      </span>
                    </li>
                  ))
                : flatFaults.map((f, i) => (
                    <li key={i}>
                      <span className="font-mono">{f.code ?? '—'}</span>
                      {f.title ? ` — ${f.title}` : ''}
                    </li>
                  ))}
            </ul>
            {showRanked && ranked.length > 3 && (
              <span className="text-xs text-gray-500 mt-0.5 block">+{ranked.length - 3} more in knowledge base</span>
            )}
            {topTwoClose && (
              <p className="text-xs text-amber-700 mt-1">Top matches are close; consider multiple.</p>
            )}
          </div>
        )}
        {hasProcedures && (
          <div>
            <span className="text-gray-500">Procedures: </span>
            <ul className="list-disc list-inside mt-0.5 space-y-0.5">
              {context.matchedProcedures!.map((p, i) => (
                <li key={i}>{p.title ?? '—'}</li>
              ))}
            </ul>
          </div>
        )}
        {hasUnresolved && (
          <div>
            <span className="text-gray-500">Unresolved codes: </span>
            {context.unresolvedCodes!.join(', ')}
          </div>
        )}
        {hasConfidence && (
          <div>
            <span className="text-gray-500">Notes: </span>
            <ul className="list-disc list-inside mt-0.5 space-y-0.5">
              {context.confidenceNotes!.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          </div>
        )}
        {hasSummary && (
          <div>
            <span className="text-gray-500">Summary: </span>
            <ul className="list-disc list-inside mt-0.5 space-y-0.5">
              {context.evidenceSummary!.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
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
  const [loadingMessage, setLoadingMessage] = useState<string>('Thinking…')
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const previewUrlRef = useRef<string | null>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

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

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null
    if (file) {
      setImageError(getImageValidationError(file) ?? null)
      revokePreviewUrl()
      const newUrl = URL.createObjectURL(file)
      previewUrlRef.current = newUrl
      setPreviewUrl(newUrl)
      setSelectedFile(file)
    } else {
      setImageError(null)
      revokePreviewUrl()
      setPreviewUrl(null)
      setSelectedFile(null)
    }
  }

  async function startNewCase() {
    setLoading(true)
    try {
      const res = await fetch('/api/cases', { method: 'POST' })
      if (!res.ok) throw new Error('Failed to create case')
      const data = await res.json()
      setCaseId(data.caseId)
      setMessages([
        {
          role: 'assistant',
          content:
            'Hi — tell me the truck year/make/model/engine and what symptoms you have. If you have fault codes (SPN/FMI), paste them. You can also upload a photo of your dashboard or scan tool screen.',
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  async function send() {
    const text = input.trim()
    if (!text || loading) return

    if (selectedFile) {
      const fileError = getImageValidationError(selectedFile)
      if (fileError) {
        setImageError(fileError)
        return
      }
    }
    setImageError(null)

    let cid = caseId

    if (!cid) {
      const res = await fetch('/api/cases', { method: 'POST' })
      const data = await res.json()
      cid = data.caseId
      setCaseId(cid)
    }

    setInput('')
    setMessages((m) => [...m, { role: 'user', content: text }])
    setLoadingMessage(selectedFile ? 'Analyzing dashboard image…' : 'Thinking…')
    setLoading(true)

    if (!cid) {
      setLoading(false)
      return
    }

    const formData = new FormData()
    formData.append('message', text)
    formData.append('caseId', cid)
    if (selectedFile) {
      formData.append('image', selectedFile)
    }

    try {
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
        (structured ? `${structured.most_likely_problem || 'Analysis complete.'}${structured.safety_message ? ` ${structured.safety_message}` : ''}`.trim() : '')
      setMessages((m) => [
        ...m,
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
      setMessages((m) => [
        ...m,
        { role: 'assistant', content: friendlyMsg },
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen p-4 md:p-8 max-w-3xl mx-auto">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h1 className="text-2xl font-bold">TruckHelpNow — Diagnostic Chat</h1>
        <button
          onClick={() => {
            setCaseId(null)
            setMessages([])
            setInput('')
            setImageError(null)
            revokePreviewUrl()
            setPreviewUrl(null)
            setSelectedFile(null)
            if (fileInputRef.current) fileInputRef.current.value = ''
          }}
          className="text-sm px-3 py-2 rounded-lg border hover:bg-gray-50"
        >
          New chat
        </button>
      </div>

      {!caseId && messages.length === 0 && (
        <div className="border rounded-xl p-4 mb-4 bg-white">
          <p className="text-gray-700">
            Start a diagnostic session. Describe symptoms, paste codes (SPN/FMI), or upload a photo of your dashboard or scan tool. We’ll save the chat as a case.
          </p>
          <button
            onClick={startNewCase}
            disabled={loading}
            className="mt-3 px-4 py-2 rounded-xl bg-black text-white font-semibold disabled:opacity-60"
          >
            {loading ? 'Starting…' : 'Start'}
          </button>
        </div>
      )}

      <div className="border rounded-xl p-4 bg-white min-h-[55vh]">
        <div className="space-y-3">
          {messages.map((m, idx) => (
            <div
              key={idx}
              className={`p-3 rounded-xl ${
                m.role === 'user' ? 'bg-gray-100' : 'bg-gray-50'
              }`}
            >
              <div className="text-xs text-gray-500 mb-1">
                {m.role === 'user' ? 'You' : 'TruckHelpNow'}
              </div>
              {m.role === 'assistant' && m.structured ? (
                <>
                  <StructuredAnalysisBlock structured={m.structured} summary={m.content} />
                  {m.knowledgeContext && (
                    <KnowledgeContextBlock context={m.knowledgeContext} />
                  )}
                </>
              ) : (
                <div className="whitespace-pre-wrap text-gray-900">
                  {m.content}
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="p-3 rounded-xl bg-gray-50 text-gray-600">
              {loadingMessage}
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') send()
          }}
          placeholder="Describe symptoms, paste codes, or add a dashboard/scanner photo…"
          className="flex-1 border rounded-xl px-4 py-3"
        />
        <button
          onClick={send}
          disabled={loading || input.trim().length === 0}
          className="px-5 py-3 rounded-xl bg-black text-white font-semibold disabled:opacity-60"
        >
          Send
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png, image/jpeg, image/jpg, image/webp"
          onChange={handleFileChange}
          className="hidden"
          id="chat-image-input"
          aria-label="Select image for upload"
        />
        <label
          htmlFor="chat-image-input"
          className="text-sm px-3 py-2 rounded-xl border border-gray-300 hover:bg-gray-50 cursor-pointer"
        >
          Choose image
        </label>
        {previewUrl && (
          <>
            <img
              src={previewUrl}
              alt="Preview of selected upload"
              className="h-14 w-14 object-cover rounded-xl border border-gray-200"
            />
            <button
              type="button"
              onClick={() => {
                setImageError(null)
                revokePreviewUrl()
                setPreviewUrl(null)
                setSelectedFile(null)
                if (fileInputRef.current) fileInputRef.current.value = ''
              }}
              className="text-xs px-2 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-50"
              aria-label="Remove selected image"
            >
              Remove
            </button>
          </>
        )}
        {imageError && (
          <p className="text-xs text-red-600 w-full mt-1" role="alert">
            {imageError}
          </p>
        )}
        <p className="text-xs text-gray-500 w-full mt-2">
          Upload a dashboard photo or scanner screenshot. Keep fault codes and warning lights clearly visible; avoid glare and blur.
        </p>
      </div>

      <p className="text-xs text-gray-500 mt-3">
        Informational guidance only. If brakes/steering/overheating/fuel
        leak/fire risk: stop and seek professional help.
      </p>
    </main>
  )
}