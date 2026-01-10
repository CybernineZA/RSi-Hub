import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireMembership } from '@/lib/rsi/session'
import { atLeast, type Role } from '@/lib/rsi/roles'

function json(data: any, status = 200) {
  return NextResponse.json(data, { status })
}

const ALLOWED_MODES = new Set(['truck', 'train', 'boat'])

export async function POST(request: Request) {
  const supabase = await createClient()
  const { user, membership } = await requireMembership(supabase)

  const role = membership.role as Role
  if (!atLeast(role, 'officer')) return json({ error: 'Forbidden' }, 403)

  const body = await request.json().catch(() => null)
  if (!body) return json({ error: 'Invalid JSON' }, 400)

  const war_id = String(body.war_id ?? '').trim()
  const container_id = String(body.container_id ?? '').trim()
  const to_location_id = String(body.to_location_id ?? '').trim()
  const mode = String(body.mode ?? '').trim()
  const route_notes = body.route_notes ? String(body.route_notes) : null

  if (!war_id || !container_id || !to_location_id) return json({ error: 'war_id, container_id, to_location_id are required' }, 400)
  if (!ALLOWED_MODES.has(mode)) return json({ error: 'mode must be one of: truck, train, boat' }, 400)

  // Fetch container + yard location
  const { data: container, error: cErr } = await supabase
    .from('containers')
    .select('id, war_id, yard_id, state, assigned_shipment_id, yards:yard_id(id, location_id)')
    .eq('id', container_id)
    .maybeSingle()

  if (cErr) return json({ error: cErr.message }, 400)
  if (!container) return json({ error: 'Container not found' }, 404)
  if (container.war_id !== war_id) return json({ error: 'Container not in this war' }, 400)
  if (container.assigned_shipment_id) return json({ error: 'Container already assigned to a shipment' }, 400)
  if (container.state !== 'ready') return json({ error: 'Only READY containers can be shipped' }, 400)
  if (!container.yard_id) return json({ error: 'Container must be in a yard to ship' }, 400)

  const from_location_id = (container as any)?.yards?.location_id ?? null

  const { data: shipment, error: sErr } = await supabase
    .from('shipments')
    .insert({
      war_id,
      mode,
      status: 'open',
      from_location_id,
      to_location_id,
      route_notes,
      created_by: user.id,
    })
    .select('id')
    .single()

  if (sErr) return json({ error: sErr.message }, 400)

  const { error: uErr } = await supabase
    .from('containers')
    .update({ assigned_shipment_id: shipment.id })
    .eq('id', container_id)

  if (uErr) return json({ error: uErr.message }, 400)

  await supabase.from('shipment_events').insert({
    shipment_id: shipment.id,
    actor_id: user.id,
    event_type: 'created',
    message: `Shipment created for container ${container_id}`,
  })

  return json({ ok: true, shipment_id: shipment.id })
}
