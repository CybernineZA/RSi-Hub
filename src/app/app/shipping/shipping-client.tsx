'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Badge } from '@/components/ui'

type Container = { id: string; label: string; yard_id: string | null }
type Location = { id: string; name: string; type: string; region: string | null }
type Shipment = {
  id: string
  status: string
  mode: string
  created_at: string
  departed_at: string | null
  arrived_at: string | null
  from_location: Location | null
  to_location: Location | null
  container: { id: string; label: string } | null
}

const STATUSES = ['open', 'loading', 'in_transit', 'arrived', 'unloaded', 'complete', 'aborted'] as const

export default function ShippingClient({
  warId,
  canManage,
  readyContainers,
  destinations,
  shipments,
}: {
  warId: string
  canManage: boolean
  readyContainers: Container[]
  destinations: Location[]
  shipments: Shipment[]
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const [containerId, setContainerId] = useState('')
  const [toLocationId, setToLocationId] = useState('')
  const [mode, setMode] = useState<'truck' | 'train' | 'boat'>('truck')
  const [notes, setNotes] = useState('')

  const destGroups = useMemo(() => {
    const byRegion = new Map<string, Location[]>()
    for (const d of destinations) {
      const key = d.region || 'Other'
      const arr = byRegion.get(key) || []
      arr.push(d)
      byRegion.set(key, arr)
    }
    return Array.from(byRegion.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  }, [destinations])

  async function createShipment() {
    setBusy(true)
    setMsg(null)
    try {
      const res = await fetch('/api/shipments', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          war_id: warId,
          container_id: containerId,
          to_location_id: toLocationId,
          mode,
          route_notes: notes || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Create failed')
      setMsg('Shipment created')
      setContainerId('')
      setToLocationId('')
      setNotes('')
      router.refresh()
    } catch (e: any) {
      setMsg(e?.message ?? String(e))
    } finally {
      setBusy(false)
    }
  }

  async function setStatus(shipmentId: string, status: string) {
    setBusy(true)
    try {
      const res = await fetch(`/api/shipments/${shipmentId}/status`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Update failed')
      router.refresh()
    } catch (e: any) {
      alert(e?.message ?? String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Create shipment</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!canManage && (
            <div className="text-sm text-neutral-400">
              Officer+ required to create shipments and update statuses.
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
            <div className="md:col-span-5">
              <div className="text-xs text-neutral-500 mb-1">Ready container</div>
              <select
                className="w-full rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-neutral-200 outline-none focus:border-neutral-600"
                value={containerId}
                onChange={(e) => setContainerId(e.target.value)}
                disabled={!canManage || busy}
              >
                <option value="">Select container…</option>
                {readyContainers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-5">
              <div className="text-xs text-neutral-500 mb-1">Dropoff destination</div>
              <select
                className="w-full rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-neutral-200 outline-none focus:border-neutral-600"
                value={toLocationId}
                onChange={(e) => setToLocationId(e.target.value)}
                disabled={!canManage || busy}
              >
                <option value="">Select destination…</option>
                {destGroups.map(([region, arr]) => (
                  <optgroup key={region} label={region}>
                    {arr.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.type})
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <div className="text-xs text-neutral-500 mb-1">Mode</div>
              <select
                className="w-full rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-neutral-200 outline-none focus:border-neutral-600"
                value={mode}
                onChange={(e) => setMode(e.target.value as any)}
                disabled={!canManage || busy}
              >
                <option value="truck">Truck</option>
                <option value="train">Train</option>
                <option value="boat">Boat</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-xs text-neutral-500">Route notes (optional)</div>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Take highway, avoid bridge fights" disabled={!canManage || busy} />
          </div>

          <div className="flex items-center justify-between">
            <div className="text-xs text-neutral-500">
              Ready containers available: <span className="text-neutral-200">{readyContainers.length}</span>
            </div>
            <Button disabled={!canManage || busy || !containerId || !toLocationId} onClick={createShipment}>
              {busy ? 'Working…' : 'Create shipment'}
            </Button>
          </div>

          {msg && <div className="text-sm text-neutral-200">{msg}</div>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-1">
          <CardTitle>Shipments</CardTitle>
          <div className="text-xs text-neutral-500">Latest {shipments.length}</div>
        </CardHeader>
        <CardContent className="space-y-4">
          {shipments.length === 0 ? (
            <div className="text-sm text-neutral-400">No shipments yet.</div>
          ) : (
            shipments.map((s) => (
              <div key={s.id} className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-4 space-y-2">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="text-sm text-neutral-200">
                      {s.container ? s.container.label : '—'} → {s.to_location?.name ?? 'Unknown'}
                    </div>
                    <div className="text-xs text-neutral-500">
                      {new Date(s.created_at).toLocaleString()} • {s.mode} • status {s.status}
                      {s.departed_at ? ` • departed ${new Date(s.departed_at).toLocaleString()}` : ''}
                      {s.arrived_at ? ` • arrived ${new Date(s.arrived_at).toLocaleString()}` : ''}
                    </div>
                  </div>
                  <Badge>{s.status.toUpperCase()}</Badge>
                </div>

                {canManage && (
                  <div className="flex flex-wrap gap-2 pt-2">
                    {STATUSES.map((st) => (
                      <Button
                        key={st}
                        variant={st === s.status ? 'default' : 'outline'}
                        disabled={busy || st === s.status}
                        onClick={() => setStatus(s.id, st)}
                      >
                        {st}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
