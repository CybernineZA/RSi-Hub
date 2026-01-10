'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Badge, Select } from '@/components/ui'

type Item = { id: string; name: string; category: string; unit: 'crate' | 'item' | 'vehicle'; crate_size: number | null }
type OrderItem = { id: string; qty_required: number; qty_done: number; items: { name: string; unit: string; category: string } | null }
type Order = { id: string; title: string; status: string; created_at: string; order_items: OrderItem[] }
type ContainerItem = { id: string; qty_required: number; qty_done: number; slot_count: number; items: { name: string; unit: string; category: string } | null }
type Container = { id: string; label: string; state: string; current_slots: number; max_slots: number; created_at: string; container_items: ContainerItem[] }

function pct(done: number, req: number) {
  if (!req) return 0
  return Math.round((done / req) * 100)
}

function sumOrder(order: Order) {
  const req = order.order_items.reduce((s, r) => s + (r.qty_required || 0), 0)
  const done = order.order_items.reduce((s, r) => s + (r.qty_done || 0), 0)
  return { req, done, p: pct(done, req) }
}

function sumContainer(c: Container) {
  const req = c.container_items.reduce((s, r) => s + (r.qty_required || 0), 0)
  const done = c.container_items.reduce((s, r) => s + (r.qty_done || 0), 0)
  return { req, done, p: pct(done, req) }
}

const ORDER_STATUSES = [
  { key: 'open', label: 'Queued' },
  { key: 'producing', label: 'Producing' },
  { key: 'ready', label: 'Ready' },
  { key: 'complete', label: 'Complete' },
] as const

type OrderStatusKey = (typeof ORDER_STATUSES)[number]['key']

function normalizeOrderStatus(raw: string | null | undefined): OrderStatusKey {
  const s = String(raw ?? '').toLowerCase().trim()
  if (s === 'open' || s === 'queued' || s === 'queue' || s === '') return 'open'
  if (s === 'producing' || s === 'in_progress' || s === 'progress' || s === 'working') return 'producing'
  if (s === 'ready' || s === 'packed' || s === 'staged') return 'ready'
  if (s === 'complete' || s === 'completed' || s === 'done' || s === 'closed') return 'complete'
  return 'open'
}


function formatTs(ts?: string | null) {
  if (!ts) return ""
  // Stable formatting to avoid server/client locale hydration mismatch
  const iso = new Date(ts).toISOString()
  return iso.replace("T", " ").slice(0, 19) + " UTC"
}

export default function ProductionClient({
  warId,
  yardId,
  items,
  orders,
  containers,
  canShip,
}: {
  warId: string
  yardId: string | null
  items: Item[]
  orders: Order[]
  containers: Container[]
  canShip: boolean
}) {
  const router = useRouter()
  const [tab, setTab] = useState<'individual' | 'container'>('individual')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const [orderList, setOrderList] = useState<Order[]>(() =>
    (orders ?? []).map((o) => ({ ...o, status: normalizeOrderStatus(o.status) }))
  )
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [draftDone, setDraftDone] = useState<Record<string, number>>({})

  useEffect(() => {
    setOrderList((orders ?? []).map((o) => ({ ...o, status: normalizeOrderStatus(o.status) })))
  }, [orders])

  const [title, setTitle] = useState('')
  const [label, setLabel] = useState('')

  const [lines, setLines] = useState<Array<{ item_id: string; qty_required: number }>>([{ item_id: '', qty_required: 1 }])

  const filteredItems = useMemo(() => {
    // group by category for <select> options
    const byCat = new Map<string, Item[]>()
    for (const it of items) {
      const arr = byCat.get(it.category) || []
      arr.push(it)
      byCat.set(it.category, arr)
    }
    return Array.from(byCat.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  }, [items])

  function updateLine(i: number, patch: Partial<{ item_id: string; qty_required: number }>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)))
  }

  function addLine() {
    setLines((prev) => [...prev, { item_id: '', qty_required: 1 }])
  }

  function removeLine(i: number) {
    setLines((prev) => prev.filter((_, idx) => idx !== i))
  }

  async function setOrderStatus(orderId: string, status: OrderStatusKey) {
    setBusy(true)
    const prev = orderList
    setOrderList((xs) => xs.map((o) => (o.id === orderId ? { ...o, status } : o)))
    try {
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      const text = await res.text()
      let data: any = null
      try {
        data = text ? JSON.parse(text) : null
      } catch {}
      if (!res.ok) throw new Error(data?.error || `Update failed (${res.status})`)
      router.refresh()
    } catch (e: any) {
      setOrderList(prev)
      alert(e?.message ?? String(e))
    } finally {
      setBusy(false)
    }
  }

  async function create() {
    setBusy(true)
    setMessage(null)
    try {
      const payload = {
        kind: tab,
        war_id: warId,
        yard_id: yardId,
        title,
        label,
        items: lines,
      }
      const res = await fetch('/api/orders/production', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const text = await res.text()

      let data: any = null

      try {

        data = text ? JSON.parse(text) : null

      } catch {}

      if (!res.ok) throw new Error(data?.error || ("Request failed (" + res.status + ")"))
      setMessage(tab === 'individual' ? 'Order created' : 'Container order created')
      setTitle('')
      setLabel('')
      setLines([{ item_id: '', qty_required: 1 }])
      router.refresh()
    } catch (e: any) {
      setMessage(e?.message ?? String(e))
    } finally {
      setBusy(false)
    }
  }

  async function setOrderItemDone(orderId: string, orderItemId: string, qty_done: number) {
    setBusy(true)
    try {
      const res = await fetch(`/api/orders/${orderId}/items`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ order_item_id: orderItemId, qty_done }),
      })
      const text = await res.text()

      let data: any = null

      try {

        data = text ? JSON.parse(text) : null

      } catch {}

      if (!res.ok) throw new Error(data?.error || ("Update failed (" + res.status + ")"))
      router.refresh()
    } catch (e: any) {
      alert(e?.message ?? String(e))
    } finally {
      setBusy(false)
    }
  }

  function laneOrders(status: OrderStatusKey) {
    return orderList
      .filter((o) => normalizeOrderStatus(o.status) === status)
      .slice()
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <CardTitle>Create production work</CardTitle>
          <div className="flex gap-2">
            <Button variant={tab === 'individual' ? 'default' : 'outline'} onClick={() => setTab('individual')}>
              Individual order
            </Button>
            <Button variant={tab === 'container' ? 'default' : 'outline'} onClick={() => setTab('container')}>
              Container order
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {tab === 'individual' ? (
            <div className="space-y-2">
              <div className="text-sm text-neutral-400">Title</div>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. 120x Bmats + 60x Shirts" />
            </div>
          ) : (
            <div className="space-y-2">
              <div className="text-sm text-neutral-400">Container label</div>
              <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Frontline Supply #12" />
              {!yardId && <div className="text-xs text-red-300">No yard found for this war. Create one in War Settings.</div>}
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-sm text-neutral-400">Line items</div>
              <Button variant="outline" onClick={addLine}>
                Add line
              </Button>
            </div>

            <div className="space-y-3">
              {lines.map((l, idx) => (
                <div key={idx} className="grid grid-cols-1 gap-2 md:grid-cols-12">
                  <div className="md:col-span-8">
                    <select
                      className="w-full rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-neutral-200 outline-none focus:border-neutral-600"
                      value={l.item_id}
                      onChange={(e) => updateLine(idx, { item_id: e.target.value })}
                    >
                      <option value="">Select item…</option>
                      {filteredItems.map(([cat, arr]) => (
                        <optgroup key={cat} label={cat}>
                          {arr.map((it) => (
                            <option key={it.id} value={it.id}>
                              {it.name} ({it.unit})
                              {it.crate_size ? ` • x${it.crate_size}` : ''}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-3">
                    <Input
                      type="number"
                      min={1}
                      value={l.qty_required}
                      onChange={(e) => updateLine(idx, { qty_required: Number(e.target.value) })}
                      placeholder="Qty"
                    />
                  </div>
                  <div className="md:col-span-1 flex md:justify-end">
                    <Button variant="outline" onClick={() => removeLine(idx)} disabled={lines.length === 1}>
                      ✕
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="text-xs text-neutral-500">
              Tip: Use <span className="text-neutral-300">qty</span> as crates for crate items, and vehicle count for vehicles.
            </div>
            <Button onClick={create} disabled={busy || (tab === 'container' && !yardId)}>
              {busy ? 'Working…' : tab === 'individual' ? 'Create order' : 'Create container order'}
            </Button>
          </div>

          {message && <div className="text-sm text-neutral-200">{message}</div>}
        </CardContent>
      </Card>

      {/* Production board */}
      <Card>
        <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Production board</CardTitle>
            <div className="text-xs text-neutral-500">Drag/drop can come later — for now use status to move orders.</div>
          </div>
          <div className="text-xs text-neutral-500">
            Tip: Expand a card to update item progress. Status is stored on the order.
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 overflow-x-auto pb-4">
            {ORDER_STATUSES.map((lane) => {
              const list = laneOrders(lane.key)
              return (
                <div key={lane.key} className="w-[340px] shrink-0">
                  <div className="sticky top-0 z-10 mb-2 rounded-2xl border border-neutral-800 bg-neutral-950/60 px-4 py-3">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold text-neutral-100">{lane.label}</div>
                      <Badge>{list.length}</Badge>
                    </div>
                  </div>

                  <div className="max-h-[calc(100vh-330px)] space-y-3 overflow-y-auto pr-1">
                    {list.length === 0 ? (
                      <div className="rounded-2xl border border-neutral-800 bg-neutral-950/30 p-4 text-sm text-neutral-400">
                        Nothing here yet.
                      </div>
                    ) : null}

                    {list.map((o) => {
                      const s = sumOrder(o)
                      const isExpanded = !!expanded[o.id]
                      return (
                        <Card key={o.id} className="hover:border-neutral-700/80">
                          <CardHeader className="p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="truncate text-sm font-semibold text-neutral-100">{o.title}</div>
                                <div className="mt-1 text-xs text-neutral-500">{formatTs(o.created_at)}</div>
                              </div>
                              <Badge className="shrink-0">{s.p}%</Badge>
                            </div>

                            <div className="mt-3 flex items-center gap-2">
                              <Select
                                value={normalizeOrderStatus(o.status)}
                                disabled={busy}
                                onChange={(e) => setOrderStatus(o.id, e.target.value as OrderStatusKey)}
                                className="h-10"
                              >
                                {ORDER_STATUSES.map((st) => (
                                  <option key={st.key} value={st.key}>
                                    {st.label}
                                  </option>
                                ))}
                              </Select>
                              {normalizeOrderStatus(o.status) !== 'complete' ? (
                                <Button
                                  variant="default"
                                  className="h-10 px-3"
                                  disabled={busy}
                                  onClick={() => setOrderStatus(o.id, 'complete')}
                                >
                                  Complete
                                </Button>
                              ) : (
                                <Button
                                  variant="outline"
                                  className="h-10 px-3"
                                  disabled={busy}
                                  onClick={() => setOrderStatus(o.id, 'open')}
                                >
                                  Reopen
                                </Button>
                              )}
                            </div>

                            <div className="mt-3">
                              <div className="h-2 w-full rounded-full bg-neutral-900">
                                <div className="h-2 rounded-full bg-lime-300" style={{ width: `${s.p}%` }} />
                              </div>
                            </div>
                          </CardHeader>

                          <CardContent className="px-4 pb-4">
                            <div className="flex items-center justify-between">
                              <div className="text-xs text-neutral-500">
                                {s.done}/{s.req} total
                              </div>
                              <Button
                                variant="ghost"
                                className="px-3 py-2 text-xs"
                                onClick={() => setExpanded((p) => ({ ...p, [o.id]: !p[o.id] }))}
                              >
                                {isExpanded ? 'Hide details' : 'Update progress'}
                              </Button>
                            </div>

                            {isExpanded ? (
                              <div className="mt-3 space-y-2">
                                {o.order_items.map((it) => {
                                  const value = draftDone[it.id] ?? it.qty_done
                                  return (
                                    <div key={it.id} className="flex items-center justify-between gap-3">
                                      <div className="min-w-0">
                                        <div className="truncate text-sm text-neutral-300">{it.items?.name ?? 'Item'}</div>
                                        <div className="text-xs text-neutral-500">
                                          {it.qty_done}/{it.qty_required}
                                        </div>
                                      </div>
                                      <Input
                                        className="w-24"
                                        type="number"
                                        min={0}
                                        max={it.qty_required}
                                        value={value}
                                        disabled={busy}
                                        onChange={(e) =>
                                          setDraftDone((p) => ({ ...p, [it.id]: Number(e.target.value) }))
                                        }
                                        onBlur={() => {
                                          const v = draftDone[it.id]
                                          if (v === undefined) return
                                          void setOrderItemDone(o.id, it.id, Number(v))
                                          setDraftDone((p) => {
                                            const { [it.id]: _, ...rest } = p
                                            return rest
                                          })
                                        }}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                                        }}
                                      />
                                    </div>
                                  )
                                })}
                              </div>
                            ) : null}
                          </CardContent>
                        </Card>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-1">
        <Card>
          <CardHeader className="flex flex-col gap-1">
            <CardTitle>Container orders</CardTitle>
            <div className="text-xs text-neutral-500">Create here, fill in the Yard, ship in Shipping.</div>
          </CardHeader>
          <CardContent className="space-y-4">
            {containers.length === 0 ? (
              <div className="text-sm text-neutral-400">No container orders yet.</div>
            ) : (
              containers.map((c) => {
                const s = sumContainer(c)
                return (
                  <div key={c.id} className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="text-sm text-neutral-200">{c.label}</div>
                        <div className="text-xs text-neutral-500">
                          {formatTs(c.created_at)} • {c.state} • slots {c.current_slots}/{c.max_slots}
                        </div>
                      </div>
                      <Badge>{s.p}%</Badge>
                    </div>
                    <div className="text-xs text-neutral-400">
                      {c.container_items.slice(0, 3).map((it) => it.items?.name).filter(Boolean).join(' • ')}
                      {c.container_items.length > 3 ? ' …' : ''}
                    </div>
                    <div className="flex items-center justify-between pt-2">
                      <a className="text-sm text-lime-200 hover:underline" href="/app/yard">
                        Open yard →
                      </a>
                      {canShip && (
                        <a className="text-sm text-lime-200 hover:underline" href="/app/shipping">
                          Shipping →
                        </a>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
