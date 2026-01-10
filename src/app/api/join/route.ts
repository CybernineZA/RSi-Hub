import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function bad(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status })
}

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anon) return bad('Server missing Supabase env vars', 500)

  const supabase = createClient(url, anon, { auth: { persistSession: false } })

  const body = await request.json().catch(() => null)
  if (!body) return bad('Invalid JSON')

  const discord_user_id = String(body.discord_user_id ?? '').trim()
  const discord_name = String(body.discord_name ?? '').trim()
  const timezone = String(body.timezone ?? '').trim()
  const typical_play_times = String(body.typical_play_times ?? '').trim()
  const experience_level = String(body.experience_level ?? '').trim()
  const notes = String(body.notes ?? '').trim()

  if (!discord_user_id || !/^[0-9]{10,30}$/.test(discord_user_id)) {
    return bad('Discord User ID must be numeric (10–30 digits).')
  }
  if (!discord_name) return bad('Discord name is required.')

  const { data: regiment, error: regErr } = await supabase
    .from('regiments')
    .select('id')
    .eq('slug', 'rsi')
    .maybeSingle()

  if (regErr || !regiment) return bad('Regiment not found', 500)

  const { error } = await supabase.from('recruit_applications').insert({
    regiment_id: regiment.id,
    discord_user_id,
    discord_name,
    timezone: timezone || null,
    typical_play_times: typical_play_times || null,
    experience_level: experience_level || null,
    notes: notes || null,
    status: 'pending',
  })

  if (error) return bad(error.message, 400)
  return NextResponse.json({ ok: true })
}
