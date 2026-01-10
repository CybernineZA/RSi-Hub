import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireMembership } from '@/lib/rsi/session'
import { atLeast, type Role } from '@/lib/rsi/roles'

function json(data: any, status = 200) {
  return NextResponse.json(data, { status })
}

const ALLOWED = new Set(['pending', 'accepted', 'rejected'])

export async function PUT(request: Request, ctx: { params: Promise<{ appId: string }> }) {
  const supabase = await createClient()
  const { user, membership } = await requireMembership(supabase)

  const role = membership.role as Role
  if (!atLeast(role, 'officer')) return json({ error: 'Forbidden' }, 403)

  const { appId } = await ctx.params
  const body = await request.json().catch(() => null)
  if (!body) return json({ error: 'Invalid JSON' }, 400)

  const status = String(body.status ?? '').trim()
  if (!ALLOWED.has(status)) return json({ error: 'Invalid status' }, 400)

  const notes = body.notes ? String(body.notes) : null

  const isReviewed = status === 'accepted' || status === 'rejected'

  const { error } = await supabase
    .from('recruit_applications')
    .update({
      status,
      reviewed_by: isReviewed ? user.id : null,
      reviewed_at: isReviewed ? new Date().toISOString() : null,
      review_notes: isReviewed ? notes : null,
    })
    .eq('id', appId)

  if (error) return json({ error: error.message }, 400)

  return json({ ok: true })
}
