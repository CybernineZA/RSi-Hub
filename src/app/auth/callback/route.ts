import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

function getDiscordId(user: any): string | null {
  const meta = user?.user_metadata ?? {}
  const candidates = [
    meta.provider_id,
    meta.sub,
    meta.id,
    meta.user_id,
    meta.discord_id,
  ]

  const identities = Array.isArray(user?.identities) ? user.identities : []
  for (const ident of identities) {
    if (ident?.provider && ident.provider !== 'discord') continue
    const id2 = ident?.provider_id ?? ident?.identity_data?.id ?? ident?.identity_data?.user_id ?? ident?.identity_data?.sub
    candidates.push(id2)
  }

  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c.trim()
    if (typeof c === 'number') return String(c)
  }
  return null
}

function getDiscordName(user: any): string | null {
  const meta = user?.user_metadata ?? {}
  const candidates = [
    meta.full_name,
    meta.name,
    meta.user_name,
    meta.preferred_username,
  ]
  for (const c of candidates) if (typeof c === 'string' && c.trim()) return c.trim()
  return null
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')

  if (!code) {
    return NextResponse.redirect(new URL('/login', url))
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    return NextResponse.redirect(new URL('/login?error=oauth', url))
  }

  const { data: userRes } = await supabase.auth.getUser()
  const user = userRes?.user
  if (!user) {
    return NextResponse.redirect(new URL('/login', url))
  }

  const discordId = getDiscordId(user)
  if (!discordId) {
    await supabase.auth.signOut()
    return NextResponse.redirect(new URL('/join?reason=missing_discord_id', url))
  }

  const admin = createAdminClient()

  // Find our regiment
  const { data: regiment, error: regErr } = await admin
    .from('regiments')
    .select('id, slug')
    .eq('slug', 'rsi')
    .maybeSingle()

  if (regErr || !regiment) {
    await supabase.auth.signOut()
    return NextResponse.redirect(new URL('/login?error=regiment', url))
  }

  // Check approval status
  const { data: appRow, error: appErr } = await admin
    .from('recruit_applications')
    .select('status, discord_name, timezone')
    .eq('regiment_id', regiment.id)
    .eq('discord_user_id', discordId)
    .order('created_at', { ascending: false })
    .maybeSingle()

  if (appErr || !appRow) {
    await supabase.auth.signOut()
    return NextResponse.redirect(new URL('/join?reason=apply_first', url))
  }

  if (appRow.status === 'rejected') {
    await supabase.auth.signOut()
    return NextResponse.redirect(new URL('/denied', url))
  }

  if (appRow.status !== 'accepted') {
    await supabase.auth.signOut()
    return NextResponse.redirect(new URL('/pending', url))
  }

  // Approved: create profile + membership
  const displayName = appRow.discord_name ?? getDiscordName(user) ?? 'RSi Member'

  const bootstrapDiscord = process.env.RSI_BOOTSTRAP_DISCORD_ID
  const bootstrapRole = (process.env.RSI_BOOTSTRAP_ROLE as any) || 'commander'
  const role = bootstrapDiscord && bootstrapDiscord === discordId ? bootstrapRole : 'member'

  await admin.from('profiles').upsert(
    {
      id: user.id,
      regiment_id: regiment.id,
      discord_id: discordId,
      discord_name: displayName,
      display_name: displayName,
      timezone: appRow.timezone ?? null,
    },
    { onConflict: 'id' }
  )

  await admin.from('memberships').upsert(
    {
      profile_id: user.id,
      regiment_id: regiment.id,
      role,
    },
    { onConflict: 'profile_id' }
  )

  return NextResponse.redirect(new URL('/app', url))
}
