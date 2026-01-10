import { redirect } from 'next/navigation'
import type { Role } from './roles'

export type Membership = { role: Role; regiment_id: string }

export async function getUserAndMembership(supabase: any) {
  const { data: userRes } = await supabase.auth.getUser()
  const user = userRes?.user
  if (!user) return { user: null, membership: null as Membership | null }

  const { data: membership, error } = await supabase
    .from('memberships')
    .select('role, regiment_id')
    .eq('profile_id', user.id)
    .maybeSingle()

  if (error) return { user, membership: null }
  return { user, membership }
}

export async function requireUser(supabase: any) {
  const { data } = await supabase.auth.getUser()
  if (!data?.user) redirect('/login')
  return data.user
}

export async function requireMembership(supabase: any, opts?: { redirectTo?: string }) {
  const { user, membership } = await getUserAndMembership(supabase)
  if (!user) redirect('/login')
  if (!membership) redirect(opts?.redirectTo ?? '/pending')
  return { user, membership }
}
