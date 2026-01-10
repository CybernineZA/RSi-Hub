import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireMembership } from '@/lib/rsi/session'
import { atLeast, type Role } from '@/lib/rsi/roles'

function json(data: any, status = 200) {
  return NextResponse.json(data, { status })
}

const ALLOWED = new Set(['open','loading','in_transit','arrived','unloaded','complete','aborted'])

export async function PUT(request: Request, ctx: { params: Promise<{ shipmentId: string }> }) {
  const supabase = await createClient()
  const { user, membership } = await requireMembership(supabase)

  const role = membership.role as Role
  if (!atLeast(role, 'officer')) return json({ error: 'Forbidden' }, 403)

  const { shipmentId } = await ctx.params
  const body = await request.json().catch(() => null)
  if (!body) return json({ error: 'Invalid JSON' }, 400)

  const status = String(body.status ?? '').trim()
  if (!ALLOWED.has(status)) return json({ error: 'Invalid status' }, 400)

  // Find the container assigned to this shipment
  const admin = createAdminClient()
  const { data: containers, error: cErr } = await admin
    .from('containers')
    .select('id, yard_id, state, assigned_shipment_id')
    .eq('assigned_shipment_id', shipmentId)

  if (cErr) return json({ error: cErr.message }, 400)
  const container = (containers ?? [])[0] ?? null

  const update: any = { status }
  const now = new Date().toISOString()

  if (status === 'in_transit') update.departed_at = now
  if (status === 'arrived' || status === 'unloaded' || status === 'complete') update.arrived_at = now

  const { error: uErr } = await supabase.from('shipments').update(update).eq('id', shipmentId)
  if (uErr) return json({ error: uErr.message }, 400)

  // Update container state transitions (service role used for container updates)
  try {
    if (container) {
      if (status === 'in_transit') {
        await admin.from('containers').update({ state: 'in_transit', yard_id: null }).eq('id', container.id)
      }
      if (status === 'complete') {
        await admin.from('containers').update({ state: 'delivered', yard_id: null, archived_at: now }).eq('id', container.id)
      }
      if (status === 'aborted') {
        // Put it back into yard as ready (if it had a yard previously)
        await admin.from('containers').update({ state: 'ready' }).eq('id', container.id)
      }
    }
  } catch (e) {
    // ignore container update errors here; shipment update already done
  }

  await supabase.from('shipment_events').insert({
    shipment_id: shipmentId,
    actor_id: user.id,
    event_type: 'status',
    message: `Shipment status -> ${status}`,
  })

  return json({ ok: true })
}
