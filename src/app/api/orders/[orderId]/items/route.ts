import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireMembership } from '@/lib/rsi/session'

function json(data: any, status = 200) {
  return NextResponse.json(data, { status })
}

export async function PUT(request: Request, ctx: { params: Promise<{ orderId: string }> }) {
  const supabase = await createClient()
  await requireMembership(supabase)

  const { orderId } = await ctx.params
  const body = await request.json().catch(() => null)
  if (!body) return json({ error: 'Invalid JSON' }, 400)

  const order_item_id = String(body.order_item_id ?? '').trim()
  const qty_done = Number(body.qty_done ?? NaN)

  if (!order_item_id) return json({ error: 'order_item_id is required' }, 400)
  if (!Number.isFinite(qty_done) || qty_done < 0) return json({ error: 'qty_done must be a non-negative number' }, 400)

  // Ensure the order item belongs to this order (protect against id confusion)
  const { data: oi, error: sErr } = await supabase
    .from('order_items')
    .select('id, qty_required, order_id')
    .eq('id', order_item_id)
    .maybeSingle()

  if (sErr) return json({ error: sErr.message }, 400)
  if (!oi || oi.order_id !== orderId) return json({ error: 'Order item not found for this order' }, 404)

  const newDone = Math.min(qty_done, oi.qty_required)

  const { error: uErr } = await supabase.from('order_items').update({ qty_done: newDone }).eq('id', order_item_id)
  if (uErr) return json({ error: uErr.message }, 400)

  return json({ ok: true })
}
