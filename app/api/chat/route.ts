import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { getSupabase } from '@/lib/supabase-server'

const systemPrompt = `You are a truck diagnostic assistant for TruckHelpNow. Help drivers with:
- Truck year, make, model, and engine type
- Symptoms and fault codes (SPN/FMI when available)
Keep answers concise and practical. Always recommend professional help for brakes, steering, overheating, fuel leaks, or fire risk. This is informational guidance only.`

export async function POST(req: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      )
    }

    const body = await req.json()
    const { caseId, message } = body as { caseId?: string; message?: string }

    if (!caseId || typeof message !== 'string' || !message.trim()) {
      return NextResponse.json(
        { error: 'caseId and message are required' },
        { status: 400 }
      )
    }

    const supabase = getSupabase()

    // Store user message
    const { error: userErr } = await supabase.from('messages').insert({
      case_id: caseId,
      role: 'user',
      content: message.trim(),
    })

    if (userErr) throw userErr

    // Load prior messages for context
    const { data: prior } = await supabase
      .from('messages')
      .select('role, content')
      .eq('case_id', caseId)
      .order('created_at', { ascending: true })

    const openai = new OpenAI({ apiKey })
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...(prior ?? []).map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user', content: message.trim() },
    ]

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
    })

    const reply =
      completion.choices[0]?.message?.content?.trim() ??
      'Unable to generate a response.'

    await supabase.from('messages').insert({
      case_id: caseId,
      role: 'assistant',
      content: reply,
    })

    return NextResponse.json({ reply })
  } catch (e) {
    console.error('POST /api/chat:', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Chat failed' },
      { status: 500 }
    )
  }
}
