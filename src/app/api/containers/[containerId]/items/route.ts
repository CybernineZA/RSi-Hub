import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireMembership } from '@/lib/rsi/session'

function json(data: any, status = 200) {
  return NextResponse.json(data, { status })
}

async function recalcContainerSlots(containerId: string) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('container_items')
    .select('qty_done, slot_count')
    .eq('container_id', containerId)

  if (error) throw new Error(error.message)

  const slots = (data ?? []).reduce((sum: number, r: any) => sum + Number(r.qty_done || 0) * Number(r.slot_count || 1), 0)

  const { error: uErr } = await admin.from('containers').update({ current_slots: slots }).eq('id', containerId)
  if (uErr) throw new Error(uErr.message)

  return slots
}

export async function PUT(request: Request, ctx: { params: Promise<{ containerId: string }> }) {
  const supabase = await createClient()
  await requireMembership(supabase)

  const { containerId } = await ctx.params
  const body = await request.json().catch(() => null)
  if (!body) return json({ error: 'Invalid JSON' }, 400)

  const container_item_id = String(body.container_item_id ?? '').trim()
  const qty_done = Number(body.qty_done ?? NaN)

  if (!container_item_id) return json({ error: 'container_item_id is required' }, 400)
  if (!Number.isFinite(qty_done) || qty_done < 0) return json({ error: 'qty_done must be a non-negative number' }, 400)

  // Validate relationship + cap at required
  const { data: ci, error: sErr } = await supabase
    .from('container_items')
    .select('id, qty_required, container_id')
    .eq('id', container_item_id)
    .maybeSingle()

  if (sErr) return json({ error: sErr.message }, 400)
  if (!ci || ci.container_id !== containerId) return json({ error: 'Container item not found for this container' }, 404)

  const newDone = Math.min(qty_done, ci.qty_required)

  const { error: uErr } = await supabase.from('container_items').update({ qty_done: newDone }).eq('id', container_item_id)
  if (uErr) return json({ error: uErr.message }, 400)

  // Recalc slots server-side (uses service role)
  try {
    const slots = await recalcContainerSlots(containerId)
    return json({ ok: true, slots })
  } catch (e: any) {
    return json({ ok: true, warning: String(e?.message ?? e) }, 200)
  }
}
