import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getDiscordId, getDiscordName } from '@/lib/rsi/discord'

function json(data: any, status = 200) {
  return NextResponse.json(data, { status })
}

function bad(msg: string, status = 400) {
  return json({ error: msg }, status)
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  if (!body) return bad('Invalid JSON')

  const timezone = String(body.timezone ?? '').trim()
  const typical_play_times = String(body.typical_play_times ?? '').trim()
  const experience_level = String(body.experience_level ?? '').trim()
  const notes = String(body.notes ?? '').trim()

  let discord_user_id = String(body.discord_user_id ?? '').trim()
  let discord_name = String(body.discord_name ?? '').trim()

  // If the user is logged in, prefer the Discord identity from their session.
  try {
    const supabase = await createClient()
    const { data } = await supabase.auth.getUser()
    const user = data?.user
    if (user) {
      const did = getDiscordId(user)
      const dname = getDiscordName(user)
      if (did) discord_user_id = did
      if (!discord_name && dname) discord_name = dname
    }
  } catch {
    // ignore
  }

  if (!discord_user_id || !/^[0-9]{10,30}$/.test(discord_user_id)) {
    return bad('Discord User ID must be numeric (10–30 digits).')
  }
  if (!discord_name) return bad('Discord name is required.')

  const admin = createAdminClient()

  const { data: regiment, error: regErr } = await admin
    .from('regiments')
    .select('id')
    .eq('slug', 'rsi')
    .maybeSingle()

  if (regErr || !regiment) return bad('Regiment not found', 500)

  // Insert the application. (Schema has a unique constraint on (regiment_id, discord_user_id))
  const { error: insErr } = await admin.from('recruit_applications').insert({
    regiment_id: regiment.id,
    discord_user_id,
    discord_name,
    timezone: timezone || null,
    typical_play_times: typical_play_times || null,
    experience_level: experience_level || null,
    notes: notes || null,
    status: 'pending',
    reviewed_by: null,
    reviewed_at: null,
  })

  if (!insErr) return json({ ok: true, status: 'pending' }, 200)

  // Unique violation: treat as "already applied" and update details if still pending.
  if ((insErr as any).code === '23505') {
    const { data: existing, error: exErr } = await admin
      .from('recruit_applications')
      .select('id, status')
      .eq('regiment_id', regiment.id)
      .eq('discord_user_id', discord_user_id)
      .maybeSingle()

    if (exErr || !existing) return json({ ok: true, status: 'pending' }, 200)

    if (existing.status === 'rejected') {
      return bad('Your application was rejected. Contact an officer if you want to appeal.', 403)
    }

    if (existing.status === 'accepted') {
      return json({ ok: true, status: 'accepted' }, 200)
    }

    // Pending: allow updating details without resetting the review state.
    await admin
      .from('recruit_applications')
      .update({
        discord_name,
        timezone: timezone || null,
        typical_play_times: typical_play_times || null,
        experience_level: experience_level || null,
        notes: notes || null,
      })
      .eq('id', existing.id)

    return json({ ok: true, status: 'pending', updated: true }, 200)
  }

  return bad(insErr.message ?? 'Failed to submit', 400)
}
