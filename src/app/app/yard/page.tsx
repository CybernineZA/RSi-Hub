import { createClient } from '@/lib/supabase/server'
import { requireMembership } from '@/lib/rsi/session'
import { atLeast, type Role } from '@/lib/rsi/roles'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui'
import YardClient from './yard-client'

export const dynamic = 'force-dynamic'

export default async function YardPage() {
  const supabase = await createClient()
  const { membership } = await requireMembership(supabase)

  const role = membership.role as Role
  const canSeal = atLeast(role, 'officer')

  const { data: regiment } = await supabase
    .from('regiments')
    .select('active_war_id')
    .eq('id', membership.regiment_id)
    .maybeSingle()

  const warId = regiment?.active_war_id ?? null

  if (!warId) {
    return (
      <div className="space-y-6">
        <div>
          <div className="text-sm text-neutral-400">Yard</div>
          <h1 className="text-3xl font-semibold tracking-tight">Container Yard</h1>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>No active war</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-neutral-300">
            Your regiment has no active war. Ask High Command to create/activate one in Admin → War.
          </CardContent>
        </Card>
      </div>
    )
  }

  const { data: yards } = await supabase
    .from('yards')
    .select('id, name')
    .eq('war_id', warId)
    .order('created_at', { ascending: true })

  const yard = (yards ?? [])[0] ?? null

  if (!yard) {
    return (
      <div className="space-y-6">
        <div>
          <div className="text-sm text-neutral-400">Yard</div>
          <h1 className="text-3xl font-semibold tracking-tight">Container Yard</h1>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>No yard configured</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-neutral-300">
            No yard exists for the active war. Create one in Admin → War (re-create the war) or insert a yard row.
          </CardContent>
        </Card>
      </div>
    )
  }

  const { data: containers } = await supabase
    .from('containers')
    .select('id, label, state, current_slots, max_slots, created_at, container_items(id, qty_required, qty_done, slot_count, items(name, unit, category))')
    .eq('war_id', warId)
    .eq('yard_id', yard.id)
    .in('state', ['filling', 'ready'])
    .order('created_at', { ascending: false })
    .limit(100)

  return (
    <div className="space-y-6">
      <div>
        <div className="text-sm text-neutral-400">Yard</div>
        <h1 className="text-3xl font-semibold tracking-tight">Container Yard</h1>
        <p className="mt-2 text-neutral-300">Fill containers and mark them ready for Shipping.</p>
      </div>

      <YardClient yardName={yard.name} containers={(containers ?? []) as any} canSeal={canSeal} />
    </div>
  )
}
