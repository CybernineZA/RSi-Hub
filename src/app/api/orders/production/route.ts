import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireMembership } from '@/lib/rsi/session'
import { atLeast, type Role } from '@/lib/rsi/roles'

function json(data: any, status = 200) {
  return NextResponse.json(data, { status })
}

type Line = { item_id: string; qty_required: number }

function normalizeLines(raw: any): Line[] {
  const list = Array.isArray(raw) ? raw : []
  const tmp: Line[] = []

  for (const it of list) {
    const item_id = String(it?.item_id ?? it?.itemId ?? it?.item ?? '').trim()
    const qtyNum = Number(it?.qty_required ?? it?.qty ?? it?.quantity ?? 0)
    const qty_required = Number.isFinite(qtyNum) ? Math.floor(qtyNum) : 0
    if (!item_id || qty_required <= 0) continue
    tmp.push({ item_id, qty_required })
  }

  // Deduplicate by item_id and sum quantities
  const summed = new Map<string, number>()
  for (const l of tmp) summed.set(l.item_id, (summed.get(l.item_id) ?? 0) + l.qty_required)

  return Array.from(summed.entries()).map(([item_id, qty_required]) => ({ item_id, qty_required }))
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { user, membership } = await requireMembership(supabase)

  const role = membership.role as Role
  if (!atLeast(role, 'member')) return json({ error: 'Forbidden' }, 403)

  const body = await request.json().catch(() => null)

  const war_id = String(body?.war_id ?? '').trim()
  const kind = String(body?.kind ?? 'individual')
  const title = String(body?.title ?? '').trim()
  const yard_id = body?.yard_id ? String(body.yard_id).trim() : null
  const label = String(body?.label ?? body?.container_label ?? title ?? '').trim()

  if (!war_id) return json({ error: 'Missing war_id' }, 400)

  const lines = normalizeLines(body?.items)
  if (lines.length < 1) return json({ error: 'Add at least 1 item line' }, 400)

  if (kind === 'container') {
    if (!yard_id) return json({ error: 'Missing yard_id' }, 400)
    if (!label) return json({ error: 'Missing container label' }, 400)

    const { data: container, error: cErr } = await supabase
      .from('containers')
      .insert({
        war_id,
        yard_id,
        label,
        state: 'filling',
        max_slots: 60,
        current_slots: 0,
        created_by: user.id,
      })
      .select('id, war_id, yard_id, label, state, max_slots, current_slots, created_at')
      .single()

    if (cErr) return json({ error: cErr.message }, 400)

    const { error: iErr } = await supabase.from('container_items').insert(
      lines.map((l) => ({
        container_id: container.id,
        item_id: l.item_id,
        qty_required: l.qty_required,
        qty_done: 0,
        slot_count: 1,
      }))
    )

    if (iErr) return json({ error: iErr.message }, 400)

    return json({ ok: true, kind: 'container', container }, 200)
  }

  // Individual order
  if (!title) return json({ error: 'Title is required' }, 400)

  const { data: order, error: oErr } = await supabase
    .from('orders')
    .insert({
      war_id,
      type: 'production',
      title,
      status: 'open',
      created_by: user.id,
    })
    .select('id, war_id, title, status, created_at')
    .single()

  if (oErr) return json({ error: oErr.message }, 400)

  const { error: liErr } = await supabase.from('order_items').insert(
    lines.map((l) => ({
      order_id: order.id,
      item_id: l.item_id,
      qty_required: l.qty_required,
      qty_done: 0,
    }))
  )

  if (liErr) return json({ error: liErr.message }, 400)

  return json({ ok: true, kind: 'individual', order }, 200)
}
