import { createClient } from '@/lib/supabase/server'
import { requireMembership } from '@/lib/rsi/session'
import { Card, CardContent, CardHeader, CardTitle, Badge } from '@/components/ui'

export const dynamic = 'force-dynamic'

type BreakdownRow = { label: string; crates: number; vehicles: number; items: number }

export default async function WarOverviewPage() {
  const supabase = await createClient()
  const { membership } = await requireMembership(supabase)

  const { data: regiment } = await supabase
    .from('regiments')
    .select('active_war_id, name')
    .eq('id', membership.regiment_id)
    .maybeSingle()

  const warId = regiment?.active_war_id ?? null

  if (!warId) {
    return (
      <div className="space-y-6">
        <div>
          <div className="text-sm text-neutral-400">War</div>
          <h1 className="text-3xl font-semibold tracking-tight">Overview</h1>
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

  const { data: war } = await supabase.from('wars').select('id, name, started_at').eq('id', warId).maybeSingle()

  const { count: deliveredContainers } = await supabase
    .from('containers')
    .select('id', { count: 'exact', head: true })
    .eq('war_id', warId)
    .eq('state', 'delivered')

  const { data: deliveredLines } = await supabase
    .from('container_items')
    .select('qty_done, items(unit, crate_size), containers!inner(id, war_id, state)')
    .eq('containers.war_id', warId)
    .eq('containers.state', 'delivered')

  let crates = 0
  let vehicles = 0
  let loose = 0
  let estItems = 0

  for (const row of deliveredLines ?? []) {
    const done = Number((row as any).qty_done ?? 0)
    const unit = String((row as any).items?.unit ?? 'crate')
    const crateSize = (row as any).items?.crate_size ? Number((row as any).items?.crate_size) : null

    if (unit === 'vehicle') vehicles += done
    else if (unit === 'item') loose += done
    else crates += done

    if (unit === 'crate') estItems += crateSize ? done * crateSize : done
    else estItems += done
  }

  const { data: shipments } = await supabase
    .from('shipments')
    .select('id, status, created_at, arrived_at, to_location:to_location_id(id,name,region,type)')
    .eq('war_id', warId)
    .order('created_at', { ascending: false })
    .limit(100)

  const completeShipmentIds = (shipments ?? []).filter((s: any) => s.status === 'complete').map((s: any) => s.id)

  // Destination breakdown (approx): sum delivered container contents by shipment destination
  const breakdown: Record<string, BreakdownRow> = {}
  if (completeShipmentIds.length) {
    const { data: containerLines } = await supabase
      .from('container_items')
      .select('qty_done, items(unit, crate_size), containers!inner(assigned_shipment_id, state)')
      .in('containers.assigned_shipment_id', completeShipmentIds)
      .eq('containers.state', 'delivered')

    // Map shipment -> destination label
    const destLabelByShipment = new Map<string, string>()
    for (const s of shipments ?? []) {
      if (s.status !== 'complete') continue
      const label = (s as any).to_location?.region ? `${(s as any).to_location.region} • ${(s as any).to_location.name}` : (s as any).to_location?.name ?? 'Unknown'
      destLabelByShipment.set(s.id, label)
    }

    for (const row of containerLines ?? []) {
      const shipId = (row as any).containers?.assigned_shipment_id as string | undefined
      const label = shipId ? destLabelByShipment.get(shipId) : null
      if (!label) continue

      const br = breakdown[label] ?? { label, crates: 0, vehicles: 0, items: 0 }
      const done = Number((row as any).qty_done ?? 0)
      const unit = String((row as any).items?.unit ?? 'crate')
      const crateSize = (row as any).items?.crate_size ? Number((row as any).items?.crate_size) : null

      if (unit === 'vehicle') br.vehicles += done
      else if (unit === 'item') br.items += done
      else br.crates += done

      // For "items" total, estimate actual loose items from crates if size known
      if (unit === 'crate') br.items += crateSize ? done * crateSize : done
      else br.items += done

      breakdown[label] = br
    }
  }

  const top = Object.values(breakdown)
    .sort((a, b) => b.crates - a.crates)
    .slice(0, 8)

  const totalShipments = shipments?.length ?? 0
  const completedShipments = (shipments ?? []).filter((s: any) => s.status === 'complete').length

  return (
    <div className="space-y-6">
      <div>
        <div className="text-sm text-neutral-400">War</div>
        <h1 className="text-3xl font-semibold tracking-tight">Overview</h1>
        <p className="mt-2 text-neutral-300">
          Delivery stats for the active war. Container contents are counted from delivered containers.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Active war</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm text-neutral-300 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-neutral-100">{war?.name ?? '—'}</div>
            <div className="text-xs text-neutral-500">
              Started {war?.started_at ? new Date(war.started_at).toLocaleDateString() : '—'}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge>Delivered containers: {deliveredContainers ?? 0}</Badge>
            <Badge>Shipments: {completedShipments}/{totalShipments} complete</Badge>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Crates delivered</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">{crates}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Vehicles delivered</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">{vehicles}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Estimated items delivered</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">{estItems}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-1">
          <CardTitle>Top destinations</CardTitle>
          <div className="text-xs text-neutral-500">Based on completed shipments with delivered containers</div>
        </CardHeader>
        <CardContent className="space-y-3">
          {top.length === 0 ? (
            <div className="text-sm text-neutral-400">No completed deliveries yet.</div>
          ) : (
            top.map((d) => (
              <div key={d.label} className="flex items-center justify-between rounded-xl border border-neutral-800 bg-neutral-900/40 px-4 py-3">
                <div className="text-sm text-neutral-200">{d.label}</div>
                <div className="text-xs text-neutral-400">
                  crates <span className="text-neutral-200">{d.crates}</span> • vehicles{' '}
                  <span className="text-neutral-200">{d.vehicles}</span>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
