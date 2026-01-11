import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireMembership } from '@/lib/rsi/session'
import { createAdminClient } from '@/lib/supabase/admin'

function json(data: any, status = 200) {
  return NextResponse.json(data, { status })
}

const ALLOWED = new Set(['open', 'in_progress', 'ready', 'complete', 'cancelled', 'producing'])

function normalizeStatus(raw: string) {
  const s = String(raw ?? '').toLowerCase().trim()
  if (s === 'producing') return 'in_progress'
  return s
}

async function archiveProductionOrder(orderId: string, actorId: string) {
  const admin = createAdminClient()

  const { data: order, error: oErr } = await admin
    .from('orders')
    .select(
      'id, war_id, type, title, status, order_no, created_by, created_at, updated_at, order_items(id, item_id, qty_required, qty_done, created_at, updated_at)'
    )
    .eq('id', orderId)
    .maybeSingle()

  if (oErr) throw new Error(oErr.message)
  if (!order) throw new Error('Order not found')

  // Only archive production orders; other order types just stay as complete.
  if (order.type !== 'production') {
    const { error } = await admin.from('orders').update({ status: 'complete' }).eq('id', orderId)
    if (error) throw new Error(error.message)
    return { archived: false }
  }

  // Insert archived order + items, then delete the live order.
  const insertOrder = {
    id: order.id,
    war_id: order.war_id,
    type: order.type,
    order_no: order.order_no ?? null,
    title: order.title,
    status: 'complete',
    created_by: order.created_by,
    created_at: order.created_at,
    updated_at: order.updated_at,
    archived_at: new Date().toISOString(),
    archived_by: actorId,
  }

  const { error: aErr } = await admin.from('archived_orders').insert(insertOrder)
  if (aErr) {
    // Graceful fallback if the user hasn't run migrations yet.
    if (aErr.message.toLowerCase().includes('does not exist')) {
      const { error } = await admin.from('orders').update({ status: 'complete' }).eq('id', orderId)
      if (error) throw new Error(error.message)
      return { archived: false, warning: 'archived_orders table missing (run migrations)' }
    }
    throw new Error(aErr.message)
  }

  const orderItems = Array.isArray(order.order_items) ? order.order_items : []
  if (orderItems.length) {
    const { error: aiErr } = await admin.from('archived_order_items').insert(
      orderItems.map((it: any) => ({
        id: it.id,
        order_id: order.id,
        item_id: it.item_id,
        qty_required: it.qty_required,
        qty_done: it.qty_done,
        created_at: it.created_at,
        updated_at: it.updated_at,
      }))
    )
    if (aiErr) throw new Error(aiErr.message)
  }

  const { error: dErr } = await admin.from('orders').delete().eq('id', orderId)
  if (dErr) throw new Error(dErr.message)

  return { archived: true }
}

export async function PUT(request: Request, ctx: { params: Promise<{ orderId: string }> }) {
  const supabase = await createClient()
  const { user } = await requireMembership(supabase)

  const { orderId } = await ctx.params
  const body = await request.json().catch(() => null)
  if (!body) return json({ error: 'Invalid JSON' }, 400)

  const raw = String(body.status ?? '').toLowerCase().trim()
  if (!raw || !ALLOWED.has(raw)) return json({ error: 'Invalid status' }, 400)

  const status = normalizeStatus(raw)

  if (status === 'complete') {
    try {
      const result = await archiveProductionOrder(orderId, user.id)
      return json({ ok: true, ...result })
    } catch (e: any) {
      return json({ error: e?.message ?? String(e) }, 400)
    }
  }

  const { error } = await supabase.from('orders').update({ status }).eq('id', orderId)
  if (error) {
    const msg = String(error.message ?? 'Update failed')
    if (status === 'ready' && msg.toLowerCase().includes('invalid input value for enum')) {
      return json(
        {
          error:
            "Your database doesn't have the 'ready' order_status yet. Apply Supabase migration 0005 (archived orders + ready status) and try again.",
        },
        400
      )
    }
    return json({ error: msg }, 400)
  }

  return json({ ok: true })
}
