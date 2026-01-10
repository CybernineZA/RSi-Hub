import { createClient } from '@/lib/supabase/server'
import { requireMembership } from '@/lib/rsi/session'
import { atLeast, type Role } from '@/lib/rsi/roles'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui'
import ShippingClient from './shipping-client'

export const dynamic = 'force-dynamic'

export default async function ShippingPage() {
  const supabase = await createClient()
  const { membership } = await requireMembership(supabase)

  const role = membership.role as Role
  const canManage = atLeast(role, 'officer')

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
          <div className="text-sm text-neutral-400">Shipping</div>
          <h1 className="text-3xl font-semibold tracking-tight">Dispatch</h1>
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

  const { data: readyContainers } = await supabase
    .from('containers')
    .select('id, label, yard_id')
    .eq('war_id', warId)
    .eq('state', 'ready')
    .is('assigned_shipment_id', null)
    .order('created_at', { ascending: false })

  const { data: destinations } = await supabase
    .from('locations')
    .select('id, name, type, region')
    .eq('war_id', warId)
    .neq('type', 'yard')
    .order('region', { ascending: true })
    .order('name', { ascending: true })

  const { data: shipments } = await supabase
    .from('shipments')
    .select(
      'id, status, mode, created_at, departed_at, arrived_at, from_location:from_location_id(id,name,type,region), to_location:to_location_id(id,name,type,region)'
    )
    .eq('war_id', warId)
    .order('created_at', { ascending: false })
    .limit(50)

  // Map shipment -> container via containers.assigned_shipment_id
  const shipmentIds = (shipments ?? []).map((s: any) => s.id)
  const containerMap = new Map<string, { id: string; label: string }>()
  if (shipmentIds.length) {
    const { data: assigned } = await supabase
      .from('containers')
      .select('id, label, assigned_shipment_id')
      .in('assigned_shipment_id', shipmentIds)

    for (const c of assigned ?? []) {
      if (c.assigned_shipment_id) containerMap.set(c.assigned_shipment_id, { id: c.id, label: c.label })
    }
  }

  const shipmentsWithContainers = (shipments ?? []).map((s: any) => ({
    ...s,
    container: containerMap.get(s.id) ?? null,
  }))

  return (
    <div className="space-y-6">
      <div>
        <div className="text-sm text-neutral-400">Shipping</div>
        <h1 className="text-3xl font-semibold tracking-tight">Dispatch</h1>
        <p className="mt-2 text-neutral-300">
          Create shipping orders by selecting a ready container and choosing a dropoff destination.
        </p>
      </div>

      <ShippingClient
        warId={warId}
        canManage={canManage}
        readyContainers={(readyContainers ?? []) as any}
        destinations={(destinations ?? []) as any}
        shipments={(shipmentsWithContainers ?? []) as any}
      />
    </div>
  )
}
