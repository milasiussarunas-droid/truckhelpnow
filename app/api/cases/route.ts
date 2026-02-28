import { NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase-server'

export async function POST() {
  try {
    const { data, error } = await getSupabase()
      .from('cases')
      .insert({})
      .select('id')
      .single()

    if (error) throw error
    if (!data?.id) throw new Error('Failed to create case')

    return NextResponse.json({ caseId: data.id })
  } catch (e) {
    console.error('POST /api/cases:', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to create case' },
      { status: 500 }
    )
  }
}
