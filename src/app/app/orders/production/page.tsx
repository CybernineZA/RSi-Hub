import { createClient } from '@/lib/supabase/server'
import { requireMembership } from '@/lib/rsi/session'
import { atLeast, type Role } from '@/lib/rsi/roles'
import { Card, CardContent, CardHeader, CardTitle, Badge } from '@/components/ui'
import ProductionClient from './production-client'

export const dynamic = 'force-dynamic'

export default async function ProductionOrdersPage() {
  const supabase = await createClient()
  const { membership } = await requireMembership(supabase)

  const role = membership.role as Role
  const canShip = atLeast(role, 'officer')

  const { data: regiment } = await supabase
    .from('regiments')
    .select('id, name, active_war_id')
    .eq('id', membership.regiment_id)
    .maybeSingle()

  const activeWarId = regiment?.active_war_id ?? null

  const { data: war } = activeWarId
    ? await supabase.from('wars').select('id, name, started_at').eq('id', activeWarId).maybeSingle()
    : { data: null as any }

  const { data: yards } = activeWarId
    ? await supabase.from('yards').select('id, name').eq('war_id', activeWarId).order('created_at', { ascending: true })
    : { data: [] as any[] }

  const yardId = (yards ?? [])[0]?.id ?? null

  const { data: items } = await supabase
    .from('items')
    .select('id, name, category, unit, crate_size')
    .order('category', { ascending: true })
    .order('name', { ascending: true })

  const { data: orders } = activeWarId
    ? await supabase
        .from('orders')
        .select('id, title, status, created_at, order_items(id, qty_required, qty_done, items(name, unit, category))')
        .eq('war_id', activeWarId)
        .eq('type', 'production')
        .order('created_at', { ascending: false })
        .limit(50)
    : { data: [] as any[] }

  const { data: containers } = activeWarId
    ? await supabase
        .from('containers')
        .select('id, label, state, current_slots, max_slots, created_at, container_items(id, qty_required, qty_done, slot_count, items(name, unit, category))')
        .eq('war_id', activeWarId)
        .in('state', ['filling', 'ready'])
        .order('created_at', { ascending: false })
        .limit(50)
    : { data: [] as any[] }

  return (
    <div className="space-y-6">
      <div>
        <div className="text-sm text-neutral-400">Orders</div>
        <h1 className="text-3xl font-semibold tracking-tight">Production</h1>
        <p className="mt-2 text-neutral-300">
          Create individual production orders or container-fill orders.
        </p>
      </div>

      {!activeWarId || !war ? (
        <Card>
          <CardHeader>
            <CardTitle>No active war</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-neutral-300 space-y-2">
            <div>
              Your regiment doesn't have an active war set. Ask High Command to create and activate a war in{' '}
              <span className="text-neutral-100">Admin → War</span>.
            </div>
            <Badge className="w-fit">Blocked</Badge>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Active war</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm text-neutral-300 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-neutral-100">{war.name}</div>
                <div className="text-xs text-neutral-500">Started {war.started_at ? new Date(war.started_at).toLocaleDateString() : '—'}</div>
              </div>
              <div className="text-xs text-neutral-500">
                Yard: <span className="text-neutral-200">{yardId ? 'OK' : 'Missing'}</span> • Items: <span className="text-neutral-200">{(items ?? []).length}</span>
              </div>
            </CardContent>
          </Card>

          <ProductionClient
            warId={war.id}
            yardId={yardId}
            items={(items ?? []) as any}
            orders={(orders ?? []) as any}
            containers={(containers ?? []) as any}
            canShip={canShip}
          />
        </>
      )}
    </div>
  )
}
