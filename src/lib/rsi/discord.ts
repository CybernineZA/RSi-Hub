// Helpers to extract Discord identity from a Supabase user object.
// Keep this logic centralized so join + callback flows stay consistent.

export function getDiscordId(user: any): string | null {
  const meta = user?.user_metadata ?? {}
  const candidates: any[] = [meta.provider_id, meta.sub, meta.id, meta.user_id, meta.discord_id]

  const identities = Array.isArray(user?.identities) ? user.identities : []
  for (const ident of identities) {
    if (ident?.provider && ident.provider !== 'discord') continue
    const id2 =
      ident?.provider_id ??
      ident?.identity_data?.id ??
      ident?.identity_data?.user_id ??
      ident?.identity_data?.sub
    candidates.push(id2)
  }

  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c.trim()
    if (typeof c === 'number') return String(c)
  }
  return null
}

export function getDiscordName(user: any): string | null {
  const meta = user?.user_metadata ?? {}
  const candidates: any[] = [meta.full_name, meta.name, meta.user_name, meta.preferred_username]
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c.trim()
  }
  return null
}
