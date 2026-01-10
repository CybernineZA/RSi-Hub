import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getDiscordId, getDiscordName } from '@/lib/rsi/discord'

function json(data: any, status = 200) {
  return NextResponse.json(data, { status })
}

// This endpoint allows a logged-in Discord user to "self-bootstrap" into the app
// once an officer has accepted their recruit application.
//
// Why this exists:
// - OAuth callback only runs on login.
// - If the user is already signed in while waiting for approval, they shouldn't have
//   to log in again once they get accepted.
export async function POST() {
  const supabase = await createClient()
  const { data: userRes } = await supabase.auth.getUser()
  const user = userRes?.user
  if (!user) return json({ loggedIn: false }, 200)

  const discordId = getDiscordId(user)
  if (!discordId) return json({ loggedIn: true, error: 'Missing Discord ID' }, 400)

  const admin = createAdminClient()

  const { data: regiment, error: regErr } = await admin
    .from('regiments')
    .select('id, slug')
    .eq('slug', 'rsi')
    .maybeSingle()

  if (regErr || !regiment) return json({ loggedIn: true, error: 'Regiment not found' }, 500)

  const { data: appRow, error: appErr } = await admin
    .from('recruit_applications')
    .select('status, discord_name, timezone')
    .eq('regiment_id', regiment.id)
    .eq('discord_user_id', discordId)
    .order('created_at', { ascending: false })
    .maybeSingle()

  if (appErr) return json({ loggedIn: true, error: appErr.message }, 400)
  if (!appRow) return json({ loggedIn: true, status: 'none' }, 200)

  if (appRow.status === 'rejected') return json({ loggedIn: true, status: 'rejected' }, 200)
  if (appRow.status !== 'accepted') return json({ loggedIn: true, status: 'pending' }, 200)

  // Accepted: ensure profile + membership exist.
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

  return json({ loggedIn: true, status: 'accepted', bootstrapped: true }, 200)
}
