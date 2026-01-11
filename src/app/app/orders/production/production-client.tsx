'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Badge, Select, Divider } from '@/components/ui'
import { ItemIcon } from '@/components/foxhole/item-icon'

type Item = {
  id: string
  name: string
  category: string | null
  unit: 'crate' | 'item' | 'vehicle'
  crate_size: number | null
  slot_count: number
  meta: any
}

type OrderItem = {
  id: string
  item_id: string
  qty_required: number
  qty_done: number
  items: Item | null
}

type Order = { id: string; title: string; status: string; created_at: string; order_items: OrderItem[] }

type ContainerItem = {
  id: string
  item_id: string
  qty_required: number
  qty_done: number
  slot_count: number
  items: Item | null
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

type Props = {
  warId: string
  yardId: string | null
  items: Item[]
  orders: Order[]
  containers: Container[]
  canShip: boolean
}

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


function safeNum(v: any): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function getCost(meta: any) {
  const c = meta?.cost ?? {}
  return {
    bmat: safeNum(c.bmat),
    rmat: safeNum(c.rmat),
    emat: safeNum(c.emat),
    hemat: safeNum(c.hemat),
  }
}

function topCost(meta: any) {
  const c = getCost(meta)
  return (Object.entries(c) as Array<[keyof typeof c, number]>)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
}

const RES = {
  bmat: { label: 'Bmats', icon: 'https://foxholelogi.com/assets/images/resources/bmat.webp' },
  rmat: { label: 'Rmats', icon: 'https://foxholelogi.com/assets/images/resources/rmat.webp' },
  emat: { label: 'Emats', icon: 'https://foxholelogi.com/assets/images/resources/emat.webp' },
  hemat: { label: 'Hemats', icon: 'https://foxholelogi.com/assets/images/resources/hemat.webp' },
} as const

function sumResources(lines: Array<{ item_id: string; qty_required: number }>, itemsById: Record<string, Item>) {
  const total = { bmat: 0, rmat: 0, emat: 0, hemat: 0 }
  for (const l of lines) {
    const it = itemsById[l.item_id]
    if (!it) continue
    const qty = Math.max(0, Math.floor(l.qty_required || 0))
    if (!qty) continue
    const c = getCost(it.meta)
    total.bmat += c.bmat * qty
    total.rmat += c.rmat * qty
    total.emat += c.emat * qty
    total.hemat += c.hemat * qty
  }
  return total
}

function sumSlots(lines: Array<{ item_id: string; qty_required: number }>, itemsById: Record<string, Item>) {
  let slots = 0
  for (const l of lines) {
    const it = itemsById[l.item_id]
    if (!it) continue
    const qty = Math.max(0, Math.floor(l.qty_required || 0))
    if (!qty) continue
    const per = Math.max(1, Math.floor(it.slot_count || 1))
    slots += qty * per
  }
  return slots
}

const ORDER_STATUSES = [
  { key: 'open', label: 'Queued' },
  { key: 'in_progress', label: 'Producing' },
  { key: 'ready', label: 'Ready' },
  { key: 'complete', label: 'Complete' },
] as const

type OrderStatusKey = (typeof ORDER_STATUSES)[number]['key']

function normalizeOrderStatus(raw: string | null | undefined): OrderStatusKey {
  const s = String(raw ?? '').toLowerCase().trim()
  if (s === 'open' || s === 'queued' || s === 'queue' || s === '') return 'open'
  if (s === 'producing' || s === 'in_progress' || s === 'progress' || s === 'working') return 'in_progress'
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

  const [lines, setLines] = useState<Array<{ item_id: string; qty_required: number }>>([])

  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<string>('all')

  const itemsById = useMemo(() => {
    const map: Record<string, Item> = {}
    for (const it of items) map[it.id] = it
    return map
  }, [items])

  const categories = useMemo(() => {
    const set = new Set<string>()
    for (const it of items) set.add((it.category || 'Uncategorized').trim() || 'Uncategorized')
    return Array.from(set.values()).sort((a, b) => a.localeCompare(b))
  }, [items])

  const filteredList = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items
      .filter((it) => {
        const c = (it.category || 'Uncategorized').trim() || 'Uncategorized'
        if (category !== 'all' && c !== category) return false
        if (!q) return true
        return it.name.toLowerCase().includes(q) || c.toLowerCase().includes(q)
      })
      .slice(0, 250)
  }, [items, query, category])

  function addFromPicker(itemId: string) {
    if (!itemId) return
    setLines((prev) => {
      const found = prev.find((l) => l.item_id === itemId)
      if (found) {
        return prev.map((l) => (l.item_id === itemId ? { ...l, qty_required: (l.qty_required || 0) + 1 } : l))
      }
      return [...prev, { item_id: itemId, qty_required: 1 }]
    })
  }

  function setQty(itemId: string, qty: number) {
    const n = Math.max(0, Math.floor(qty || 0))
    setLines((prev) => prev.map((l) => (l.item_id === itemId ? { ...l, qty_required: n } : l)).filter((l) => (l.qty_required || 0) > 0))
  }

  function removeLineByItem(itemId: string) {
    setLines((prev) => prev.filter((l) => l.item_id !== itemId))
  }

  const totalSlots = useMemo(() => sumSlots(lines, itemsById), [lines, itemsById])
  const resTotals = useMemo(() => sumResources(lines, itemsById), [lines, itemsById])
  const containerLimit = 60
  const isOverLimit = tab === 'container' && totalSlots > containerLimit
  const slotsRemaining = tab === 'container' ? Math.max(0, containerLimit - totalSlots) : null


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
      const validLines = lines.filter((l) => l.item_id && (l.qty_required || 0) > 0)
      if (validLines.length === 0) throw new Error('Add at least 1 item line')

      if (tab === 'container') {
        if (!yardId) throw new Error('No yard found for this war')
        if (isOverLimit) throw new Error(`Container limit is ${containerLimit} crates/slots`)
      }
      const payload = {
        kind: tab,
        war_id: warId,
        yard_id: yardId,
        title,
        label,
        items: validLines,
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
      setLines([])
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
          <div className="space-y-1">
            <CardTitle>Create production work</CardTitle>
            <div className="text-xs text-neutral-500">Search + icons, with a live queue. Container orders are limited to 60 crates/slots.</div>
          </div>

          <div className="flex gap-2">
            <Button variant={tab === 'individual' ? 'solid' : 'outline'} onClick={() => setTab('individual')}>
              Individual order
            </Button>
            <Button variant={tab === 'container' ? 'solid' : 'outline'} onClick={() => setTab('container')}>
              Container order
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/*
            Layout:
              - Top row: Info/filters + Queue
              - Bottom: Items list (full width) with its own scroll

            This avoids squeezing the items column and keeps the picker readable.
          */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
            {/* Top-left: info + filters */}
            <div className="rounded-2xl border border-neutral-800 bg-neutral-950/30 p-4 space-y-4">
              {tab === 'individual' ? (
                <div className="space-y-2">
                  <div className="text-sm text-neutral-400">Title (optional)</div>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. 60x Rifles • 60x Shirts" />
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="text-sm text-neutral-400">Container label</div>
                  <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Frontline Supply #12" />
                  {!yardId && <div className="text-xs text-red-300">No yard found for this war. Create one in War Settings.</div>}
                </div>
              )}

              <Divider />

              <div className="space-y-2">
                <div className="text-sm text-neutral-400">Search</div>
                <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search items…" />
              </div>

              <div className="space-y-2">
                <div className="text-sm text-neutral-400">Category</div>
                <Select value={category} onChange={(e) => setCategory(e.target.value)}>
                  <option value="all">All</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
              </div>

              {tab === 'container' ? (
                <div className="rounded-2xl border border-neutral-800 bg-neutral-950/40 p-3">
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-neutral-400">Crates/slots</div>
                    <Badge className={isOverLimit ? 'border-red-900/60 text-red-200' : ''}>
                      {totalSlots}/{containerLimit}
                    </Badge>
                  </div>
                  <div className="mt-2 h-2 w-full rounded-full bg-neutral-900 overflow-hidden">
                    <div className="h-full bg-lime-300" style={{ width: `${Math.min(100, (totalSlots / containerLimit) * 100)}%` }} />
                  </div>
                  {isOverLimit ? (
                    <div className="mt-2 text-xs text-red-300">Over the limit — reduce crates before creating.</div>
                  ) : (
                    <div className="mt-2 text-xs text-neutral-500">{slotsRemaining} slots remaining</div>
                  )}
                </div>
              ) : (
                <div className="text-xs text-neutral-500">
                  Tip: build your queue first, then create the order. Use status lanes to track progress.
                </div>
              )}
            </div>

            {/* Top-right: queue */}
            <div className="rounded-2xl border border-neutral-800 bg-neutral-950/30">
              <div className="p-4 border-b border-neutral-800">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium text-neutral-200">Queue</div>
                  {tab === 'container' ? (
                    <Badge className={isOverLimit ? 'border-red-900/60 text-red-200' : ''}>
                      {totalSlots}/{containerLimit}
                    </Badge>
                  ) : (
                    <Badge>{lines.filter((l) => l.item_id).length} items</Badge>
                  )}
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {(Object.keys(RES) as Array<keyof typeof RES>).map((k) =>
                    resTotals[k] > 0 ? (
                      <span
                        key={k}
                        className="inline-flex items-center gap-2 rounded-full border border-neutral-800 bg-neutral-950/40 px-2.5 py-1 text-xs text-neutral-200"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={RES[k].icon} alt="" className="h-4 w-4 rounded bg-neutral-900 object-contain" />
                        <span className="tabular-nums">{resTotals[k]}</span>
                        <span className="text-neutral-400">{RES[k].label}</span>
                      </span>
                    ) : null
                  )}

                  {resTotals.bmat + resTotals.rmat + resTotals.emat + resTotals.hemat === 0 && (
                    <div className="text-xs text-neutral-500">Resource totals will appear here.</div>
                  )}
                </div>
              </div>

              <div className="p-3 max-h-[360px] md:max-h-[420px] overflow-y-auto space-y-2">
                {lines
                  .filter((l) => l.item_id && itemsById[l.item_id])
                  .map((l) => {
                    const it = itemsById[l.item_id]
                    const imgName = String(it.meta?.imgName ?? it.meta?.image ?? it.meta?.icon ?? '').trim()
                    return (
                      <div
                        key={l.item_id}
                        className="flex items-center gap-3 rounded-2xl border border-neutral-800 bg-neutral-950/40 p-3"
                      >
                        <ItemIcon imgName={imgName} alt={it.name} className="h-9 w-9" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium text-neutral-100">{it.name}</div>
                          <div className="text-xs text-neutral-500">{it.category}</div>
                        </div>
                        <Input
                          type="number"
                          min={1}
                          value={l.qty_required}
                          onChange={(e) => setQty(l.item_id, Number(e.target.value))}
                          className="w-24"
                        />
                        <Button variant="outline" onClick={() => removeLineByItem(l.item_id)} aria-label="Remove">
                          ✕
                        </Button>
                      </div>
                    )
                  })}

                {!lines.filter((l) => l.item_id && itemsById[l.item_id]).length && (
                  <div className="p-3 text-sm text-neutral-500">Nothing here yet — add items from the list.</div>
                )}
              </div>

              <div className="p-4 border-t border-neutral-800 space-y-2">
                <Button
                  onClick={create}
                  disabled={busy || (tab === 'container' && (!yardId || isOverLimit))}
                  className="w-full"
                >
                  {busy ? 'Working…' : tab === 'individual' ? 'Create order' : 'Create container order'}
                </Button>
                <div className="text-xs text-neutral-500">
                  Tip: qty is crates for crate items. Vehicles also count as slots.
                </div>
              </div>
            </div>
          </div>

          {/* Bottom: full-width items list with independent scrolling */}
          <div className="rounded-2xl border border-neutral-800 bg-neutral-950/30">
            <div className="p-3 border-b border-neutral-800 flex items-center justify-between">
              <div className="text-sm font-medium text-neutral-200">Items</div>
              <div className="text-xs text-neutral-500">{filteredList.length} shown</div>
            </div>

            <div className="h-[420px] md:h-[520px] overflow-y-auto p-2 space-y-2">
              {filteredList.map((it) => {
                const imgName = String(it.meta?.imgName ?? it.meta?.image ?? it.meta?.icon ?? '').trim()
                const addSlots = Math.max(1, Math.floor(it.slot_count || 1))
                const canAdd = tab !== 'container' || totalSlots + addSlots <= containerLimit

                return (
                  <div key={it.id} className="flex items-center gap-3 rounded-2xl border border-neutral-800 bg-neutral-950/40 p-3">
                    <ItemIcon imgName={imgName} alt={it.name} className="h-9 w-9" />

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <div className="truncate text-sm font-semibold text-neutral-100">{it.name}</div>
                        <span className="text-[10px] rounded-full border border-neutral-700 px-2 py-0.5 text-neutral-300">
                          {it.unit}
                        </span>
                      </div>

                      <div className="mt-1 flex flex-wrap gap-2">
                        {topCost(it.meta).map(([k, v]) => (
                          <span
                            key={String(k)}
                            className="inline-flex items-center gap-2 rounded-full border border-neutral-800 bg-neutral-950/40 px-2.5 py-1 text-xs text-neutral-200"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={RES[k].icon} alt="" className="h-4 w-4 rounded bg-neutral-900 object-contain" />
                            <span className="tabular-nums">{v}</span>
                            <span className="text-neutral-400">{RES[k].label}</span>
                          </span>
                        ))}
                        {!topCost(it.meta).length && <span className="text-xs text-neutral-500">No cost data</span>}
                      </div>
                    </div>

                    <Button variant="outline" onClick={() => addFromPicker(it.id)} disabled={busy || (tab === 'container' && !canAdd)}>
                      + Add
                    </Button>
                  </div>
                )
              })}

              {!filteredList.length && <div className="p-3 text-sm text-neutral-500">No items match your search.</div>}
            </div>
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
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {ORDER_STATUSES.map((lane) => {
              const list = laneOrders(lane.key)
              return (
                <div key={lane.key} className="min-w-0">
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
