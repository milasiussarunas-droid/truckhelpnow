'use client'

import { useEffect, useRef, useState } from 'react'

type ChatMsg = { role: 'user' | 'assistant'; content: string }

export default function ChatPage() {
  const [caseId, setCaseId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

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
            'Hi — tell me the truck year/make/model/engine and what symptoms you have. If you have fault codes (SPN/FMI), paste them too.',
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  async function send() {
    const text = input.trim()
    if (!text || loading) return

    let cid = caseId

    if (!cid) {
      const res = await fetch('/api/cases', { method: 'POST' })
      const data = await res.json()
      cid = data.caseId
      setCaseId(cid)
    }

    setInput('')
    setMessages((m) => [...m, { role: 'user', content: text }])
    setLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caseId: cid, message: text }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Chat failed')

      setMessages((m) => [...m, { role: 'assistant', content: data.reply }])
    } catch (e: any) {
      setMessages((m) => [
        ...m,
        { role: 'assistant', content: `Error: ${e?.message ?? 'Unknown error'}` },
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
          }}
          className="text-sm px-3 py-2 rounded-lg border hover:bg-gray-50"
        >
          New chat
        </button>
      </div>

      {!caseId && messages.length === 0 && (
        <div className="border rounded-xl p-4 mb-4 bg-white">
          <p className="text-gray-700">
            Start a diagnostic session. We’ll save the chat as a case.
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
              <div className="whitespace-pre-wrap text-gray-900">
                {m.content}
              </div>
            </div>
          ))}

          {loading && (
            <div className="p-3 rounded-xl bg-gray-50 text-gray-600">
              Thinking…
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
          placeholder="Describe symptoms / codes…"
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

      <p className="text-xs text-gray-500 mt-3">
        Informational guidance only. If brakes/steering/overheating/fuel
        leak/fire risk: stop and seek professional help.
      </p>
    </main>
  )
}