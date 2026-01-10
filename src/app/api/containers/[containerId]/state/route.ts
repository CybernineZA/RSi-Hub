import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireMembership } from '@/lib/rsi/session'
import { atLeast, type Role } from '@/lib/rsi/roles'

function json(data: any, status = 200) {
  return NextResponse.json(data, { status })
}

const ALLOWED = new Set(['filling', 'ready', 'in_transit', 'delivered'])

export async function PUT(request: Request, ctx: { params: Promise<{ containerId: string }> }) {
  const supabase = await createClient()
  const { membership } = await requireMembership(supabase)

  const role = membership.role as Role

  const { containerId } = await ctx.params
  const body = await request.json().catch(() => null)
  if (!body) return json({ error: 'Invalid JSON' }, 400)

  const state = String(body.state ?? '').trim()
  if (!ALLOWED.has(state)) return json({ error: 'Invalid state' }, 400)

  // Member+ can move a container to READY, but only if fully filled.
  if (state === 'ready') {
    if (!atLeast(role, 'member')) return json({ error: 'Forbidden' }, 403)

    const { data: rows, error: rErr } = await supabase
      .from('container_items')
      .select('qty_required, qty_done')
      .eq('container_id', containerId)

    if (rErr) return json({ error: rErr.message }, 400)
    const allDone = (rows ?? []).length > 0 && (rows ?? []).every((r: any) => Number(r.qty_done) >= Number(r.qty_required))
    if (!allDone) return json({ error: 'Cannot set READY unless the container is fully filled' }, 400)
  } else {
    // Other state transitions are Officer+
    if (!atLeast(role, 'officer')) return json({ error: 'Forbidden' }, 403)
  }

  const { error } = await supabase.from('containers').update({ state }).eq('id', containerId)
  if (error) return json({ error: error.message }, 400)

  return json({ ok: true })
}
