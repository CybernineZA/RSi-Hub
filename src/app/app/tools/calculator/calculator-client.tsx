'use client'

import * as React from 'react'
import { A, Badge, Button, Card, CardContent, CardHeader, CardTitle, Divider, Input, cn } from '@/components/ui'
import { ItemIcon } from '@/components/foxhole/item-icon'

type DbItem = {
  id: string
  slug: string
  name: string
  category: string | null
  unit: string | null
  crate_size: number | null
  image_name: string | null
  meta: any
}

type Line = {
  item: DbItem
  crates: number
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

function getProducedPerCrate(meta: any): number {
  return safeNum(meta?.numberProduced)
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

export default function CalculatorClient({ items }: { items: DbItem[] }) {
  const [q, setQ] = React.useState('')
  const [cat, setCat] = React.useState<string>('All')
  const [lines, setLines] = React.useState<Line[]>([])

  const categories = React.useMemo(() => {
    const set = new Set<string>()
    for (const it of items) {
      if (it.category) set.add(it.category)
    }
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
    const t = { bmat: 0, rmat: 0, emat: 0, hemat: 0, crates: 0, produced: 0 }
    for (const line of lines) {
      const cost = getCost(line.item.meta)
      t.bmat += cost.bmat * line.crates
      t.rmat += cost.rmat * line.crates
      t.emat += cost.emat * line.crates
      t.hemat += cost.hemat * line.crates
      t.crates += line.crates
      t.produced += getProducedPerCrate(line.item.meta) * line.crates
    }
    return t
  }, [lines])

  function addItem(item: DbItem) {
    setLines((prev) => {
      const idx = prev.findIndex((l) => l.item.id === item.id)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = { ...next[idx], crates: next[idx].crates + 1 }
        return next
      }
      return [...prev, { item, crates: 1 }]
    })
  }

  function setCrates(itemId: string, crates: number) {
    const v = Math.max(1, Math.min(9999, Math.floor(crates || 1)))
    setLines((prev) => prev.map((l) => (l.item.id === itemId ? { ...l, crates: v } : l)))
  }

  function removeItem(itemId: string) {
    setLines((prev) => prev.filter((l) => l.item.id !== itemId))
  }

  async function copySummary() {
    const rows = lines
      .slice()
      .sort((a, b) => a.item.name.localeCompare(b.item.name))
      .map((l) => `${l.crates}x crates — ${l.item.name}`)

    const res = [
      `Total crates: ${totals.crates}`,
      `Total produced: ${totals.produced}`,
      `Costs: ${totals.bmat} bmats, ${totals.rmat} rmats, ${totals.emat} emats, ${totals.hemat} hemats`,
      '',
      ...rows,
    ].join('\n')

    try {
      await navigator.clipboard.writeText(res)
    } catch {
      // ignore
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-sm text-neutral-400">Tools</div>
          <h1 className="text-3xl font-semibold tracking-tight">Cost calculator</h1>
          <p className="mt-2 text-neutral-300">
            Add crate orders and get the total resource cost. Data + icons are sourced from{' '}
            <A href="https://foxholelogi.com/">FoxholeLogi</A>.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setLines([])} disabled={lines.length === 0}>
            Clear
          </Button>
          <Button onClick={copySummary} disabled={lines.length === 0}>
            Copy summary
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>Items</CardTitle>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex-1">
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search items…"
                />
              </div>
              <div className="flex gap-2 overflow-auto">
                {categories.map((c) => (
                  <button
                    key={c}
                    className={cn(
                      'whitespace-nowrap rounded-xl border px-3 py-2 text-xs transition',
                      c === cat
                        ? 'border-lime-300/50 bg-lime-300/10 text-lime-200'
                        : 'border-neutral-800 bg-neutral-950/40 text-neutral-300 hover:bg-neutral-900/60'
                    )}
                    onClick={() => setCat(c)}
                    type="button"
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.slice(0, 300).map((it) => {
                const cost = getCost(it.meta)
                const produced = getProducedPerCrate(it.meta)
                const img = it.meta?.imgName ?? it.image_name

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
                        {it.unit && <Badge className="shrink-0">{it.unit}</Badge>}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-2">
                        <ResChip k="bmat" value={cost.bmat} />
                        <ResChip k="rmat" value={cost.rmat} />
                        <ResChip k="emat" value={cost.emat} />
                        <ResChip k="hemat" value={cost.hemat} />
                      </div>
                      <div className="mt-2 text-xs text-neutral-400">
                        {produced ? `Produces ${produced} per crate` : '—'}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
            {filtered.length > 300 && (
              <div className="mt-4 text-xs text-neutral-500">
                Showing first 300 results. Refine your search to narrow it down.
              </div>
            )}
          </CardContent>
        </Card>

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
              Total crates: <span className="text-neutral-200 tabular-nums">{totals.crates}</span>
              {totals.produced ? (
                <>
                  {' '}
                  • Total produced:{' '}
                  <span className="text-neutral-200 tabular-nums">{totals.produced}</span>
                </>
              ) : null}
            </div>
          </CardHeader>
          <CardContent>
            {lines.length === 0 ? (
              <div className="rounded-2xl border border-neutral-800 bg-neutral-950/40 p-4 text-sm text-neutral-400">
                No items added yet. Click an item to add 1 crate.
              </div>
            ) : (
              <div className="space-y-3">
                {lines.map((l) => {
                  const img = l.item.meta?.imgName ?? l.item.image_name
                  const produced = getProducedPerCrate(l.item.meta)

                  return (
                    <div key={l.item.id} className="rounded-2xl border border-neutral-800 bg-neutral-950/40 p-3">
                      <div className="flex gap-3">
                        <ItemIcon imgName={img} alt={l.item.name} className="h-10 w-10 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium text-neutral-100">{l.item.name}</div>
                          <div className="mt-1 text-xs text-neutral-400">
                            {produced ? `Produces ${produced * l.crates} total` : '—'}
                          </div>
                        </div>
                        <button
                          className="rounded-xl border border-neutral-800 px-2 py-1 text-xs text-neutral-300 hover:bg-neutral-900/60"
                          onClick={() => removeItem(l.item.id)}
                          type="button"
                        >
                          Remove
                        </button>
                      </div>

                      <Divider className="my-3" />

                      <div className="flex items-center gap-2">
                        <div className="text-xs text-neutral-400">Crates</div>
                        <input
                          value={String(l.crates)}
                          onChange={(e) => setCrates(l.item.id, Number(e.target.value))}
                          className="w-24 rounded-xl border border-neutral-800 bg-neutral-950/40 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-lime-300/60 focus:ring-2 focus:ring-lime-300/20"
                          inputMode="numeric"
                        />
                        <div className="ml-auto flex gap-2">
                          <button
                            type="button"
                            className="rounded-xl border border-neutral-800 px-3 py-2 text-xs text-neutral-300 hover:bg-neutral-900/60"
                            onClick={() => setCrates(l.item.id, l.crates - 1)}
                          >
                            -
                          </button>
                          <button
                            type="button"
                            className="rounded-xl border border-neutral-800 px-3 py-2 text-xs text-neutral-300 hover:bg-neutral-900/60"
                            onClick={() => setCrates(l.item.id, l.crates + 1)}
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            <div className="mt-6 text-xs text-neutral-500">
              Data source: <span className="font-mono">https://foxholelogi.com/assets/foxhole.json</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
