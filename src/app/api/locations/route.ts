import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { atLeast, type Role } from '@/lib/rsi/roles'
import { requireMembership } from '@/lib/rsi/session'

function json(data: any, status = 200) {
  return NextResponse.json(data, { status })
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const { membership } = await requireMembership(supabase)

  const url = new URL(request.url)
  const war_id = url.searchParams.get('war_id')
  const region = url.searchParams.get('region')

  let q = supabase.from('locations').select('id, war_id, name, type, region, grid_ref, notes, created_at').order('region', { ascending: true }).order('name', { ascending: true })
  if (war_id) q = q.eq('war_id', war_id)
  if (region) q = q.eq('region', region)

  const { data, error } = await q
  if (error) return json({ error: error.message }, 400)
  return json({ data })
}

async function requireOfficer() {
  const supabase = await createClient()
  const { membership } = await requireMembership(supabase)
  const role = membership.role as Role
  if (!atLeast(role, 'officer')) return { supabase, error: 'Forbidden' as string }
  return { supabase, error: null as string | null }
}

export async function POST(request: Request) {
  const { supabase, error } = await requireOfficer()
  if (error) return json({ error }, 403)

  const body = await request.json().catch(() => null)
  if (!body) return json({ error: 'Invalid JSON' }, 400)

  const payload = {
    war_id: body.war_id,
    name: String(body.name ?? '').trim(),
    type: body.type,
    region: body.region ? String(body.region).trim() : null,
    grid_ref: body.grid_ref ? String(body.grid_ref).trim() : null,
    notes: body.notes ? String(body.notes).trim() : null,
  }

  if (!payload.war_id) return json({ error: 'war_id is required' }, 400)
  if (!payload.name) return json({ error: 'name is required' }, 400)
  if (!payload.type) return json({ error: 'type is required' }, 400)
  if (!payload.region) return json({ error: 'region is required' }, 400)

  const { data, error: insErr } = await supabase.from('locations').insert(payload).select().single()
  if (insErr) return json({ error: insErr.message }, 400)
  return json({ data })
}

export async function PUT(request: Request) {
  const { supabase, error } = await requireOfficer()
  if (error) return json({ error }, 403)

  const body = await request.json().catch(() => null)
  if (!body) return json({ error: 'Invalid JSON' }, 400)

  const id = String(body.id ?? '').trim()
  if (!id) return json({ error: 'id is required' }, 400)

  const patch: any = {}
  if (body.name != null) patch.name = String(body.name).trim()
  if (body.type != null) patch.type = body.type
  if (body.region != null) patch.region = String(body.region).trim()
  if (body.grid_ref != null) patch.grid_ref = String(body.grid_ref).trim() || null
  if (body.notes != null) patch.notes = String(body.notes).trim() || null

  const { data, error: upErr } = await supabase.from('locations').update(patch).eq('id', id).select().single()
  if (upErr) return json({ error: upErr.message }, 400)
  return json({ data })
}

export async function DELETE(request: Request) {
  const { supabase, error } = await requireOfficer()
  if (error) return json({ error }, 403)

  const url = new URL(request.url)
  const id = url.searchParams.get('id')
  if (!id) return json({ error: 'id is required' }, 400)

  const { error: delErr } = await supabase.from('locations').delete().eq('id', id)
  if (delErr) return json({ error: delErr.message }, 400)
  return json({ ok: true })
}
