import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireMembership } from '@/lib/rsi/session'

function json(data: any, status = 200) {
  return NextResponse.json(data, { status })
}

const ALLOWED = new Set(['open', 'in_progress', 'ready', 'complete'])

export async function PUT(request: Request, ctx: { params: Promise<{ orderId: string }> }) {
  const supabase = await createClient()
  await requireMembership(supabase)

  const { orderId } = await ctx.params
  const body = await request.json().catch(() => null)
  if (!body) return json({ error: 'Invalid JSON' }, 400)

  const status = String(body.status ?? '').toLowerCase().trim()

  const mapped = status === 'producing' ? 'in_progress' : status
  if (!mapped || !ALLOWED.has(mapped)) return json({ error: 'Invalid status' }, 400)

  const { error } = await supabase.from('orders').update({ status: mapped }).eq('id', orderId)
  if (error) return json({ error: error.message }, 400)

  return json({ ok: true })
}
