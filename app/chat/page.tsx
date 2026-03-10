'use client'

import { useEffect, useRef, useState } from 'react'

type DiagnosticStructured = {
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

/** Message history entry. Same shape for text-only and image analysis: role + content always set; structured only when backend returns dashboard analysis. */
type ChatMsg = {
  role: 'user' | 'assistant'
  content: string
  structured?: DiagnosticStructured
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
    typeof o.likely_issue_summary === 'string' &&
    Array.isArray(o.codes_detected) &&
    Array.isArray(o.warnings_detected) &&
    Array.isArray(o.recommended_checks) &&
    typeof o.safety_message === 'string' &&
    typeof o.note === 'string'
  )
}

function StructuredAnalysisBlock({
  structured,
  summary,
}: {
  structured: DiagnosticStructured
  summary: string
}) {
  const section = (label: string, value: string | string[]) => {
    if (Array.isArray(value)) {
      if (value.length === 0) return null
      return (
        <div className="mb-3 last:mb-0">
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
            {label}
          </div>
          <ul className="list-disc list-inside text-gray-900 space-y-0.5">
            {value.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
      )
    }
    if (!value.trim()) return null
    return (
      <div className="mb-3 last:mb-0">
        <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
          {label}
        </div>
        <div className="text-gray-900 whitespace-pre-wrap">{value}</div>
      </div>
    )
  }

  const safetyClass =
    structured.safety_level === 'high'
      ? 'border-amber-200 bg-amber-50'
      : structured.safety_level === 'medium'
        ? 'border-yellow-200 bg-yellow-50'
        : 'border-gray-200 bg-white'

  return (
    <div className="space-y-3">
      {summary ? (
        <div className="whitespace-pre-wrap text-gray-900 mb-3">{summary}</div>
      ) : null}
      {section('Likely issue', structured.likely_issue_summary)}
      {section('Codes detected', structured.codes_detected)}
      {section('Warnings detected', structured.warnings_detected)}
      {section('Recommended checks', structured.recommended_checks)}
      {structured.safety_message ? (
        <div
          className={`rounded-lg border p-3 ${safetyClass}`}
          role="alert"
        >
          <div className="text-xs font-medium text-gray-600 uppercase tracking-wide mb-1">
            Safety
          </div>
          <div className="text-gray-900">{structured.safety_message}</div>
        </div>
      ) : null}
      {section('Confidence', structured.confidence)}
      {section('Note', structured.note)}
      <p className="text-xs text-gray-500 mt-3 pt-2 border-t border-gray-200">
        AI analysis is guidance only. Verify safety-critical warnings before driving.
      </p>
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

      setMessages((m) => [
        ...m,
        {
          role: 'assistant',
          content: data.reply ?? '',
          structured: hasStructured(data) ? data.structured : undefined,
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
                <StructuredAnalysisBlock structured={m.structured} summary={m.content} />
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