'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input, Select, cn } from '@/components/ui'
import { ItemIcon } from '@/components/foxhole/item-icon'

type DbItem = {
  id: string
  slug: string
  name: string
  category: string | null
  unit: 'crate' | 'item' | 'vehicle' | string | null
  crate_size: number | null
  slot_count: number | null
  meta: any
}

type OrderItem = {
  id: string
  qty_required: number
  qty_done: number
  items: DbItem | null
}

type Order = {
  id: string
  order_no?: number | null
  title: string
  status: string
  created_at: string
  order_items: OrderItem[]
}

type ContainerItem = {
  id: string
  qty_required: number
  qty_done: number
  slot_count: number
  items: DbItem | null
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

type Line = { item_id: string; qty_required: number }

function pct(done: number, req: number) {
  if (!req) return 0
  return Math.round((done / req) * 100)
}

function safeNum(v: any): number {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN
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

const RES = {
  bmat: { label: 'Bmats', icon: 'https://foxholelogi.com/assets/images/resources/bmat.webp' },
  rmat: { label: 'Rmats', icon: 'https://foxholelogi.com/assets/images/resources/rmat.webp' },
  emat: { label: 'Emats', icon: 'https://foxholelogi.com/assets/images/resources/emat.webp' },
  hemat: { label: 'Hemats', icon: 'https://foxholelogi.com/assets/images/resources/hemat.webp' },
} as const

function ResChip({ k, value }: { k: keyof typeof RES; value: number }) {
  if (!value) return null
  const r = RES[k]
  return (
    <div className="inline-flex items-center gap-2 rounded-xl border border-neutral-800 bg-neutral-950/40 px-2.5 py-1 text-xs text-neutral-200">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={r.icon} alt={r.label} className="h-4 w-4" loading="lazy" />
      <span className="tabular-nums">{value}</span>
      <span className="text-neutral-400">{r.label}</span>
    </div>
  )
}

function formatTs(ts?: string | null) {
  if (!ts) return ''
  // Stable formatting to avoid server/client locale hydration mismatch
  const iso = new Date(ts).toISOString()
  return iso.replace('T', ' ').slice(0, 19) + ' UTC'
}

function clampInt(v: number, min: number, max: number) {
  const n = Math.floor(Number.isFinite(v) ? v : min)
  return Math.max(min, Math.min(max, n))
}

const ORDER_LANES = [
  { key: 'open', label: 'Queued' },
  { key: 'in_progress', label: 'Producing' },
  { key: 'ready', label: 'Ready' },
  { key: 'complete', label: 'Complete' },
] as const

type LaneKey = (typeof ORDER_LANES)[number]['key']

function normalizeLane(raw: string | null | undefined): LaneKey {
  const s = String(raw ?? '').toLowerCase().trim()
  if (s === 'open' || s === 'queued' || s === 'queue' || s === '') return 'open'
  if (s === 'in_progress' || s === 'progress' || s === 'working' || s === 'producing') return 'in_progress'
  if (s === 'ready' || s === 'packed' || s === 'staged') return 'ready'
  if (s === 'complete' || s === 'completed' || s === 'done') return 'complete'
  return 'open'
}

function sumOrder(o: Order) {
  const req = o.order_items.reduce((s, r) => s + (r.qty_required || 0), 0)
  const done = o.order_items.reduce((s, r) => s + (r.qty_done || 0), 0)
  return { req, done, p: pct(done, req) }
}

function sumContainer(c: Container) {
  const req = c.container_items.reduce((s, r) => s + (r.qty_required || 0), 0)
  const done = c.container_items.reduce((s, r) => s + (r.qty_done || 0), 0)
  return { req, done, p: pct(done, req) }
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
  items: DbItem[]
  orders: Order[]
  containers: Container[]
  canShip: boolean
}) {
  const router = useRouter()
  const [tab, setTab] = React.useState<'individual' | 'container'>('individual')
  const [busy, setBusy] = React.useState(false)
  const [message, setMessage] = React.useState<string | null>(null)

  const [expanded, setExpanded] = React.useState<Record<string, boolean>>({})
  const [draftDone, setDraftDone] = React.useState<Record<string, number>>({})

  // Create form state
  const [title, setTitle] = React.useState('')
  const [label, setLabel] = React.useState('')
  const [q, setQ] = React.useState('')
  const [cat, setCat] = React.useState<string>('All')
  const [lines, setLines] = React.useState<Line[]>([])

  const itemById = React.useMemo(() => {
    const m = new Map<string, DbItem>()
    for (const it of items) m.set(it.id, it)
    return m
  }, [items])

  const categories = React.useMemo(() => {
    const set = new Set<string>()
    for (const it of items) if (it.category) set.add(it.category)
    return ['All', ...Array.from(set).sort((a, b) => a.localeCompare(b))]
  }, [items])

  const filtered = React.useMemo(() => {
    const qq = q.trim().toLowerCase()
    return items.filter((it) => {
      if (cat !== 'All' && (it.category ?? 'Uncategorized') !== cat) return false
      if (!qq) return true
      const hay = `${it.name} ${it.slug} ${it.category ?? ''}`.toLowerCase()
      return hay.includes(qq)
    })
  }, [items, q, cat])

  const totals = React.useMemo(() => {
    const t = { slots: 0, bmat: 0, rmat: 0, emat: 0, hemat: 0 }
    for (const l of lines) {
      const it = itemById.get(l.item_id)
      if (!it) continue
      const qty = clampInt(l.qty_required || 0, 0, 9999)
      const sc = clampInt(Number(it.slot_count ?? 1), 1, 60)
      t.slots += qty * sc
      const cost = getCost(it.meta)
      t.bmat += cost.bmat * qty
      t.rmat += cost.rmat * qty
      t.emat += cost.emat * qty
      t.hemat += cost.hemat * qty
    }
    return t
  }, [lines, itemById])

  const overCapacity = tab === 'container' && totals.slots > 60

  function addItem(item: DbItem) {
    setLines((prev) => {
      const idx = prev.findIndex((l) => l.item_id === item.id)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = { ...next[idx], qty_required: clampInt(next[idx].qty_required + 1, 1, 9999) }
        return next
      }
      return [...prev, { item_id: item.id, qty_required: 1 }]
    })
  }

  function setQty(itemId: string, qty: number) {
    const v = clampInt(qty || 1, 1, 9999)
    setLines((prev) => prev.map((l) => (l.item_id === itemId ? { ...l, qty_required: v } : l)))
  }

  function removeLine(itemId: string) {
    setLines((prev) => prev.filter((l) => l.item_id !== itemId))
  }

  function buildDefaultTitle() {
    const parts = lines
      .slice()
      .filter((l) => itemById.get(l.item_id))
      .sort((a, b) => {
        const ia = itemById.get(a.item_id)!
        const ib = itemById.get(b.item_id)!
        return ia.name.localeCompare(ib.name)
      })
      .slice(0, 3)
      .map((l) => {
        const it = itemById.get(l.item_id)!
        return `${l.qty_required}x ${it.name}`
      })

    return parts.length ? parts.join(' • ') : 'Production order'
  }

  async function create() {
    setBusy(true)
    setMessage(null)
    try {
      const safeTitle = tab === 'individual' ? (title.trim() || buildDefaultTitle()) : ''
      const safeLabel = tab === 'container' ? (label.trim() || buildDefaultTitle()) : ''

      const payload = {
        kind: tab,
        war_id: warId,
        yard_id: yardId,
        title: safeTitle,
        label: safeLabel,
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
      } catch {
        // ignore
      }
      if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`)

      setMessage(tab === 'individual' ? 'Order created' : 'Container order created')
      setTitle('')
      setLabel('')
      setLines([])
      setQ('')
      setCat('All')
      router.refresh()
    } catch (e: any) {
      setMessage(e?.message ?? String(e))
    } finally {
      setBusy(false)
    }
  }

  async function setOrderStatus(orderId: string, status: LaneKey) {
    setBusy(true)
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
      } catch {
        // ignore
      }
      if (!res.ok) throw new Error(data?.error || `Update failed (${res.status})`)
      router.refresh()
    } catch (e: any) {
      alert(e?.message ?? String(e))
    } finally {
      setBusy(false)
    }
  }

  async function completeAndArchive(orderId: string) {
    setBusy(true)
    try {
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: 'complete' }),
      })
      const text = await res.text()
      let data: any = null
      try {
        data = text ? JSON.parse(text) : null
      } catch {
        // ignore
      }
      if (!res.ok) throw new Error(data?.error || `Complete failed (${res.status})`)
      router.refresh()
    } catch (e: any) {
      alert(e?.message ?? String(e))
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
      } catch {
        // ignore
      }
      if (!res.ok) throw new Error(data?.error || `Update failed (${res.status})`)
      router.refresh()
    } catch (e: any) {
      alert(e?.message ?? String(e))
    } finally {
      setBusy(false)
    }
  }

  const laneOrders = React.useMemo(() => {
    const grouped: Record<LaneKey, Order[]> = {
      open: [],
      in_progress: [],
      ready: [],
      complete: [],
    }
    for (const o of orders ?? []) {
      const st = String(o.status ?? '').toLowerCase().trim()
      if (st === 'cancelled' || st === 'canceled') continue
      const lane = normalizeLane(o.status)
      grouped[lane].push(o)
    }
    for (const k of Object.keys(grouped) as LaneKey[]) {
      grouped[k].sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    }
    return grouped
  }, [orders])

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Create production work</CardTitle>
            <div className="mt-1 text-xs text-neutral-500">
              Add items with icons + search. Container orders are limited to 60 crates.
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant={tab === 'individual' ? 'default' : 'outline'} onClick={() => setTab('individual')}>
              Individual order
            </Button>
            <Button variant={tab === 'container' ? 'default' : 'outline'} onClick={() => setTab('container')}>
              Container order
            </Button>
          </div>
        </CardHeader>

        <CardContent className="grid gap-6 lg:grid-cols-[1fr_420px]">
          {/* Left: picker */}
          <div className="min-w-0">
            <div className="grid gap-3 sm:grid-cols-2">
              {tab === 'individual' ? (
                <div className="sm:col-span-2">
                  <div className="text-sm text-neutral-400">Title (optional)</div>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. 60x Rifles • 60x Shirts"
                    className="mt-2"
                  />
                </div>
              ) : (
                <div className="sm:col-span-2">
                  <div className="text-sm text-neutral-400">Container label</div>
                  <Input
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder="e.g. Frontline Supply #12"
                    className="mt-2"
                  />
                  {!yardId ? (
                    <div className="mt-2 text-xs text-red-300">
                      No yard found for this war. Create one in War Settings.
                    </div>
                  ) : null}
                </div>
              )}
            </div>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex-1">
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search items…" />
              </div>
              <Select value={cat} onChange={(e) => setCat(e.target.value)} className="sm:w-[220px]">
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.slice(0, 180).map((it) => {
                const img = it.meta?.imgName
                const cost = getCost(it.meta)
                return (
                  <button
                    key={it.id}
                    type="button"
                    className="group flex w-full items-start gap-3 rounded-2xl border border-neutral-800 bg-neutral-950/40 p-3 text-left transition hover:bg-neutral-900/60"
                    onClick={() => addItem(it)}
                    title="Add 1 crate"
                  >
                    <ItemIcon imgName={img} alt={it.name} className="h-12 w-12 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <div className="truncate text-sm font-medium text-neutral-100">{it.name}</div>
                        {it.unit ? <Badge className="shrink-0">{it.unit}</Badge> : null}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-2">
                        <ResChip k="bmat" value={cost.bmat} />
                        <ResChip k="rmat" value={cost.rmat} />
                        <ResChip k="emat" value={cost.emat} />
                        <ResChip k="hemat" value={cost.hemat} />
                      </div>
                      <div className="mt-2 text-xs text-neutral-500 truncate">{it.category ?? 'Uncategorized'}</div>
                    </div>
                  </button>
                )
              })}
            </div>

            {filtered.length > 180 ? (
              <div className="mt-4 text-xs text-neutral-500">
                Showing first 180 results. Refine your search to narrow it down.
              </div>
            ) : null}
          </div>

          {/* Right: queue */}
          <div className="min-w-0">
            <Card className="min-w-0">
              <CardHeader>
                <CardTitle>Queue</CardTitle>
                <div className="mt-2 flex flex-wrap gap-2">
                  <ResChip k="bmat" value={totals.bmat} />
                  <ResChip k="rmat" value={totals.rmat} />
                  <ResChip k="emat" value={totals.emat} />
                  <ResChip k="hemat" value={totals.hemat} />
                </div>
                <div className="mt-3 text-sm text-neutral-400">
                  Total crates:{' '}
                  <span className={cn('tabular-nums', overCapacity ? 'text-red-200' : 'text-neutral-200')}>
                    {totals.slots}
                  </span>
                  {tab === 'container' ? (
                    <>
                      {' '}
                      / <span className="text-neutral-300">60</span>
                    </>
                  ) : null}
                </div>
                {overCapacity ? (
                  <div className="mt-2 text-xs text-red-300">
                    Over capacity. A container can only hold 60 crates (vehicles count as crates).
                  </div>
                ) : null}
              </CardHeader>
              <CardContent>
                {lines.length === 0 ? (
                  <div className="rounded-2xl border border-neutral-800 bg-neutral-950/40 p-4 text-sm text-neutral-400">
                    No items added yet. Click an item to add 1 crate.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {lines
                      .slice()
                      .sort((a, b) => {
                        const ia = itemById.get(a.item_id)
                        const ib = itemById.get(b.item_id)
                        return (ia?.name ?? '').localeCompare(ib?.name ?? '')
                      })
                      .map((l) => {
                        const it = itemById.get(l.item_id)
                        if (!it) return null
                        const img = it.meta?.imgName
                        return (
                          <div key={l.item_id} className="flex items-center gap-3 rounded-2xl border border-neutral-800 bg-neutral-950/40 p-3">
                            <ItemIcon imgName={img} alt={it.name} className="h-10 w-10" />
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm text-neutral-100">{it.name}</div>
                              <div className="mt-1 flex flex-wrap gap-2">
                                <ResChip k="bmat" value={getCost(it.meta).bmat * l.qty_required} />
                                <ResChip k="rmat" value={getCost(it.meta).rmat * l.qty_required} />
                                <ResChip k="emat" value={getCost(it.meta).emat * l.qty_required} />
                                <ResChip k="hemat" value={getCost(it.meta).hemat * l.qty_required} />
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Input
                                className="w-24"
                                type="number"
                                min={1}
                                value={l.qty_required}
                                onChange={(e) => setQty(l.item_id, Number(e.target.value))}
                              />
                              <Button variant="outline" onClick={() => removeLine(l.item_id)} title="Remove">
                                ✕
                              </Button>
                            </div>
                          </div>
                        )
                      })}
                  </div>
                )}

                <div className="mt-4 flex flex-col gap-2">
                  <Button
                    onClick={create}
                    disabled={
                      busy ||
                      lines.length === 0 ||
                      (tab === 'container' && (!yardId || overCapacity))
                    }
                  >
                    {busy ? 'Working…' : tab === 'individual' ? 'Create order' : 'Create container order'}
                  </Button>
                  {message ? <div className="text-sm text-neutral-200">{message}</div> : null}
                </div>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      {/* Production board */}
      <Card>
        <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Production board</CardTitle>
            <div className="text-xs text-neutral-500">Move orders using status. Completing archives the order and counts it in War overview.</div>
          </div>
          <div className="text-xs text-neutral-500">Tip: Expand a card to update item progress.</div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {ORDER_LANES.map((lane) => {
              const list = laneOrders[lane.key]
              return (
                <div key={lane.key} className="min-w-0">
                  <div className="mb-2 rounded-2xl border border-neutral-800 bg-neutral-950/60 px-4 py-3">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold text-neutral-100">{lane.label}</div>
                      <Badge>{list.length}</Badge>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {list.length === 0 ? (
                      <div className="rounded-2xl border border-neutral-800 bg-neutral-950/30 p-4 text-sm text-neutral-400">
                        Nothing here yet.
                      </div>
                    ) : null}

                    {list.map((o) => {
                      const s = sumOrder(o)
                      const isExpanded = !!expanded[o.id]

                      const icons = o.order_items
                        .map((x) => x.items?.meta?.imgName)
                        .filter(Boolean)
                        .slice(0, 6) as string[]

                      return (
                        <Card key={o.id} className="hover:border-neutral-700/80">
                          <CardHeader className="p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="truncate text-sm font-semibold text-neutral-100">
                                  {o.order_no ? `#${o.order_no} — ` : ''}{o.title}
                                </div>
                                <div className="mt-1 text-xs text-neutral-500">{formatTs(o.created_at)}</div>
                                {icons.length ? (
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    {icons.map((img, idx) => (
                                      <ItemIcon key={idx} imgName={img} alt="" className="h-8 w-8" />
                                    ))}
                                  </div>
                                ) : null}
                              </div>
                              <Badge className="shrink-0">{s.p}%</Badge>
                            </div>

                            <div className="mt-3 flex items-center gap-2">
                              <Select
                                value={normalizeLane(o.status)}
                                disabled={busy}
                                onChange={(e) => setOrderStatus(o.id, e.target.value as LaneKey)}
                                className="h-10"
                              >
                                {ORDER_LANES.map((st) => (
                                  <option key={st.key} value={st.key} disabled={st.key === 'complete'}>
                                    {st.label}
                                  </option>
                                ))}
                              </Select>

                              <Button
                                className="h-10 px-3"
                                disabled={busy || normalizeLane(o.status) === 'complete'}
                                onClick={() => completeAndArchive(o.id)}
                                title="Completes and archives the order"
                              >
                                {normalizeLane(o.status) === 'complete' ? 'Completed' : 'Complete'}
                              </Button>
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
                                        onChange={(e) => setDraftDone((p) => ({ ...p, [it.id]: Number(e.target.value) }))}
                                        onBlur={() => {
                                          const v = draftDone[it.id]
                                          if (v === undefined) return
                                          void setOrderItemDone(o.id, it.id, clampInt(Number(v), 0, it.qty_required))
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

      {/* Container orders */}
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
              const preview = c.container_items
                .map((it) => it.items?.name)
                .filter(Boolean)
                .slice(0, 3)
                .join(' • ')
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
                    {preview}{c.container_items.length > 3 ? ' …' : ''}
                  </div>
                  <div className="flex items-center justify-between pt-2">
                    <a className="text-sm text-lime-200 hover:underline" href="/app/yard">
                      Open yard →
                    </a>
                    {canShip ? (
                      <a className="text-sm text-lime-200 hover:underline" href="/app/shipping">
                        Shipping →
                      </a>
                    ) : null}
                  </div>
                </div>
              )
            })
          )}
        </CardContent>
      </Card>
    </div>
  )
}
