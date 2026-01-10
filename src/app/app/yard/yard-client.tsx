'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Badge } from '@/components/ui'

type ContainerItem = {
  id: string
  qty_required: number
  qty_done: number
  slot_count: number
  items: { name: string; unit: string; category: string } | null
}

type Container = {
  id: string
  label: string
  state: string
  current_slots: number
  max_slots: number
  created_at: string
  container_items: ContainerItem[]
}

function allDone(c: Container) {
  return c.container_items.every((i) => (i.qty_done ?? 0) >= (i.qty_required ?? 0))
}

export default function YardClient({ yardName, containers, canSeal }: { yardName: string; containers: Container[]; canSeal: boolean }) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  async function updateItem(containerId: string, containerItemId: string, qty_done: number) {
    setBusy(containerItemId)
    try {
      const res = await fetch(`/api/containers/${containerId}/items`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ container_item_id: containerItemId, qty_done }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Update failed')
      router.refresh()
    } catch (e: any) {
      alert(e?.message ?? String(e))
    } finally {
      setBusy(null)
    }
  }

  async function setState(containerId: string, state: string) {
    setBusy(containerId)
    try {
      const res = await fetch(`/api/containers/${containerId}/state`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ state }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Update failed')
      router.refresh()
    } catch (e: any) {
      alert(e?.message ?? String(e))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Yard: {yardName}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-neutral-300">
          Fill containers by updating the <span className="text-neutral-100">done</span> count. When ready, Officer+ can mark a container as{' '}
          <span className="text-neutral-100">READY</span> so it appears on Shipping.
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-1">
          <CardTitle>Containers in yard</CardTitle>
          <div className="text-xs text-neutral-500">{containers.length} total</div>
        </CardHeader>
        <CardContent className="space-y-4">
          {containers.length === 0 ? (
            <div className="text-sm text-neutral-400">No containers staged in this yard.</div>
          ) : (
            containers.map((c) => {
              const done = c.container_items.reduce((s, r) => s + (r.qty_done || 0), 0)
              const req = c.container_items.reduce((s, r) => s + (r.qty_required || 0), 0)
              const pct = req ? Math.round((done / req) * 100) : 0
              const isDone = allDone(c)

              return (
                <div key={c.id} className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-4 space-y-3">
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="text-sm text-neutral-200">{c.label}</div>
                      <div className="text-xs text-neutral-500">
                        {new Date(c.created_at).toLocaleString()} • {c.state} • slots {c.current_slots}/{c.max_slots}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge>{pct}%</Badge>
                      <Button variant="outline" onClick={() => setExpanded((p) => ({ ...p, [c.id]: !p[c.id] }))}>
                        {expanded[c.id] ? 'Hide' : 'View'}
                      </Button>
                      {canSeal && c.state === 'filling' && (
                        <Button disabled={!isDone || busy === c.id} onClick={() => setState(c.id, 'ready')}>
                          Mark ready
                        </Button>
                      )}
                      {canSeal && c.state === 'ready' && (
                        <Button variant="outline" disabled={busy === c.id} onClick={() => setState(c.id, 'filling')}>
                          Reopen
                        </Button>
                      )}
                    </div>
                  </div>

                  {expanded[c.id] && (
                    <div className="space-y-3">
                      {c.container_items.map((it) => (
                        <div key={it.id} className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                          <div className="text-sm text-neutral-300">
                            {it.items?.name ?? 'Item'}{' '}
                            <span className="text-neutral-500">({it.items?.unit ?? '—'})</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="text-xs text-neutral-500 w-32 text-right">
                              {it.qty_done}/{it.qty_required}
                            </div>
                            <Input
                              className="w-24"
                              type="number"
                              min={0}
                              max={it.qty_required}
                              value={it.qty_done}
                              disabled={busy === it.id || busy === c.id}
                              onChange={(e) => updateItem(c.id, it.id, Number(e.target.value))}
                            />
                            <Button
                              variant="outline"
                              disabled={busy === it.id || busy === c.id || it.qty_done >= it.qty_required}
                              onClick={() => updateItem(c.id, it.id, Math.min(it.qty_required, (it.qty_done || 0) + 1))}
                            >
                              +1
                            </Button>
                          </div>
                        </div>
                      ))}
                      <div className="text-xs text-neutral-500">
                        Tip: <span className="text-neutral-200">done</span> is how many crates/vehicles are already packed into the container.
                      </div>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </CardContent>
      </Card>
    </div>
  )
}
