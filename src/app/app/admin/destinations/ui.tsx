'use client'

import Image from 'next/image'
import { useMemo, useState } from 'react'
import { Button, Card, CardContent, CardHeader, Divider, Input, Select, Table, Td, Th, Textarea } from '@/components/ui'

type LocationRow = {
  id: string
  war_id: string
  name: string
  type: 'yard' | 'seaport' | 'depot' | 'facility' | 'front'
  region: string | null
  grid_ref: string | null
  notes: string | null
  created_at?: string
}

const TYPE_OPTIONS: Array<LocationRow['type']> = ['depot', 'front', 'seaport', 'facility', 'yard']

export default function DestinationsClient({
  warId,
  warName,
  initialLocations,
}: {
  warId: string | null
  warName: string | null
  initialLocations: LocationRow[]
}) {
  const [locations, setLocations] = useState<LocationRow[]>(initialLocations)
  const [region, setRegion] = useState<string>('')

  const regions = useMemo(() => {
    const s = new Set<string>()
    for (const l of locations) if (l.region) s.add(l.region)
    return Array.from(s).sort((a, b) => a.localeCompare(b))
  }, [locations])

  const filtered = useMemo(() => {
    if (!region) return locations.filter((l) => !!l.region)
    return locations.filter((l) => l.region === region)
  }, [locations, region])

  const [newRow, setNewRow] = useState({
    region: '',
    name: '',
    type: 'depot' as LocationRow['type'],
    grid_ref: '',
    notes: '',
  })

  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  async function refresh(selectedRegion?: string) {
    if (!warId) return
    const url = new URL('/api/locations', window.location.origin)
    url.searchParams.set('war_id', warId)
    if (selectedRegion) url.searchParams.set('region', selectedRegion)
    const res = await fetch(url.toString(), { method: 'GET' })
    const data = await res.json()
    if (!res.ok) throw new Error(data?.error ?? 'Failed to load locations')
    const fresh = data.data as LocationRow[]
    // If region filtered, merge into current list
    if (selectedRegion) {
      setLocations((prev) => {
        const kept = prev.filter((l) => l.region !== selectedRegion)
        return [...kept, ...fresh].sort((a, b) => (a.region ?? '').localeCompare(b.region ?? '') || a.name.localeCompare(b.name))
      })
    } else {
      setLocations(fresh)
    }
  }

  async function createLocation() {
    if (!warId) return
    setBusy(true)
    setErr(null)
    setMsg(null)
    try {
      const payload = {
        war_id: warId,
        region: newRow.region.trim() || region,
        name: newRow.name.trim(),
        type: newRow.type,
        grid_ref: newRow.grid_ref.trim() || null,
        notes: newRow.notes.trim() || null,
      }
      if (!payload.region) throw new Error('Pick a region first.')
      if (!payload.name) throw new Error('Town / dropoff name is required.')

      const res = await fetch('/api/locations', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? 'Failed to create')

      setLocations((prev) => [data.data as LocationRow, ...prev])
      setNewRow({ region: '', name: '', type: 'depot', grid_ref: '', notes: '' })
      setMsg('Added.')
    } catch (e: any) {
      setErr(e?.message ?? 'Error')
    } finally {
      setBusy(false)
    }
  }

  const [editingId, setEditingId] = useState<string | null>(null)
  const [edit, setEdit] = useState({
    region: '',
    name: '',
    type: 'depot' as LocationRow['type'],
    grid_ref: '',
    notes: '',
  })

  function startEdit(row: LocationRow) {
    setEditingId(row.id)
    setEdit({
      region: row.region ?? '',
      name: row.name ?? '',
      type: row.type,
      grid_ref: row.grid_ref ?? '',
      notes: row.notes ?? '',
    })
    setErr(null)
    setMsg(null)
  }

  async function saveEdit() {
    if (!editingId) return
    setBusy(true)
    setErr(null)
    setMsg(null)
    try {
      const res = await fetch('/api/locations', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          id: editingId,
          region: edit.region.trim(),
          name: edit.name.trim(),
          type: edit.type,
          grid_ref: edit.grid_ref.trim() || null,
          notes: edit.notes.trim() || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? 'Failed to update')
      const updated = data.data as LocationRow
      setLocations((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))
      setEditingId(null)
      setMsg('Saved.')
    } catch (e: any) {
      setErr(e?.message ?? 'Error')
    } finally {
      setBusy(false)
    }
  }

  async function remove(id: string) {
    if (!confirm('Delete this destination?')) return
    setBusy(true)
    setErr(null)
    setMsg(null)
    try {
      const url = new URL('/api/locations', window.location.origin)
      url.searchParams.set('id', id)
      const res = await fetch(url.toString(), { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? 'Failed to delete')
      setLocations((prev) => prev.filter((r) => r.id !== id))
      setMsg('Deleted.')
    } catch (e: any) {
      setErr(e?.message ?? 'Error')
    } finally {
      setBusy(false)
    }
  }

  if (!warId) {
    return (
      <Card>
        <CardHeader>
          <div className="text-sm text-neutral-400">Admin</div>
          <div className="text-2xl font-semibold">Destinations</div>
        </CardHeader>
        <CardContent className="text-sm text-neutral-300">
          No active war is set. High Command must set an active war in <a className="text-lime-200 underline underline-offset-4" href="/app/admin/war">War Settings</a>.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="text-sm text-neutral-400">Admin</div>
        <h1 className="text-3xl font-semibold tracking-tight">Destinations</h1>
        <p className="mt-2 text-neutral-300">
          Active war: <b>{warName ?? warId}</b>. Seeded defaults are editable — rename them to real towns, add more dropoffs, or remove unused ones.
        </p>
      </div>

      <Card className="overflow-hidden">
        <div className="relative aspect-[16/7] w-full">
          <Image src="/foxhole-map.png" alt="Foxhole map regions" fill className="object-cover opacity-90" priority />
          <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-transparent to-transparent" />
          <div className="absolute bottom-4 left-4 rounded-2xl border border-neutral-800 bg-neutral-950/60 px-3 py-2 text-sm text-neutral-200">
            Tip: seed regions in <a className="text-lime-200 underline underline-offset-4" href="/app/admin/war">War Settings</a>, then edit towns here.
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <div className="text-sm text-neutral-400">Filter</div>
          <div className="text-xl font-semibold">Region</div>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="mb-1 block text-sm text-neutral-300">Region</label>
            <Select value={region} onChange={(e) => setRegion(e.target.value)}>
              <option value="">All regions</option>
              {regions.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </Select>
          </div>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => refresh(region || undefined).catch((e) => setErr(e.message))}
          >
            Refresh
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="text-sm text-neutral-400">Add destination</div>
          <div className="text-xl font-semibold">Region + Town dropoff</div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="sm:col-span-1">
              <label className="mb-1 block text-sm text-neutral-300">Region</label>
              <Input
                placeholder={region ? region : 'e.g. Deadlands'}
                value={newRow.region}
                onChange={(e) => setNewRow({ ...newRow, region: e.target.value })}
              />
              <div className="mt-1 text-xs text-neutral-500">
                Leave blank to use the selected filter region.
              </div>
            </div>
            <div className="sm:col-span-1">
              <label className="mb-1 block text-sm text-neutral-300">Town / dropoff name</label>
              <Input value={newRow.name} onChange={(e) => setNewRow({ ...newRow, name: e.target.value })} />
            </div>
            <div className="sm:col-span-1">
              <label className="mb-1 block text-sm text-neutral-300">Type</label>
              <Select value={newRow.type} onChange={(e) => setNewRow({ ...newRow, type: e.target.value as any })}>
                {TYPE_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm text-neutral-300">Grid ref (optional)</label>
              <Input
                placeholder="e.g. F6"
                value={newRow.grid_ref}
                onChange={(e) => setNewRow({ ...newRow, grid_ref: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-neutral-300">Notes (optional)</label>
              <Input
                placeholder="e.g. seaport, safe route via..."
                value={newRow.notes}
                onChange={(e) => setNewRow({ ...newRow, notes: e.target.value })}
              />
            </div>
          </div>

          {err && <div className="rounded-xl border border-red-900/60 bg-red-950/40 p-3 text-sm text-red-100">{err}</div>}
          {msg && <div className="rounded-xl border border-lime-300/30 bg-lime-300/10 p-3 text-sm text-lime-100">{msg}</div>}

          <Button disabled={busy} onClick={() => createLocation()}>
            {busy ? 'Working…' : 'Add destination'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="text-sm text-neutral-400">Destinations</div>
          <div className="text-xl font-semibold">{region ? `${region} dropoffs` : 'All dropoffs'}</div>
        </CardHeader>
        <CardContent className="space-y-3">
          <Table>
            <thead>
              <tr>
                <Th>Region</Th>
                <Th>Name</Th>
                <Th>Type</Th>
                <Th>Grid</Th>
                <Th>Notes</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => {
                const editing = editingId === row.id
                return (
                  <tr key={row.id} className="hover:bg-neutral-900/30">
                    <Td className="min-w-[180px]">
                      {editing ? (
                        <Input value={edit.region} onChange={(e) => setEdit({ ...edit, region: e.target.value })} />
                      ) : (
                        row.region
                      )}
                    </Td>
                    <Td className="min-w-[180px]">
                      {editing ? (
                        <Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
                      ) : (
                        row.name
                      )}
                    </Td>
                    <Td>
                      {editing ? (
                        <Select value={edit.type} onChange={(e) => setEdit({ ...edit, type: e.target.value as any })}>
                          {TYPE_OPTIONS.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </Select>
                      ) : (
                        row.type
                      )}
                    </Td>
                    <Td className="min-w-[90px]">
                      {editing ? (
                        <Input
                          value={edit.grid_ref}
                          onChange={(e) => setEdit({ ...edit, grid_ref: e.target.value })}
                          placeholder="F6"
                        />
                      ) : (
                        row.grid_ref ?? ''
                      )}
                    </Td>
                    <Td className="min-w-[220px]">
                      {editing ? (
                        <Input
                          value={edit.notes}
                          onChange={(e) => setEdit({ ...edit, notes: e.target.value })}
                          placeholder="Optional"
                        />
                      ) : (
                        row.notes ?? ''
                      )}
                    </Td>
                    <Td className="whitespace-nowrap">
                      {editing ? (
                        <div className="flex gap-2">
                          <Button disabled={busy} onClick={() => saveEdit()}>
                            Save
                          </Button>
                          <Button
                            disabled={busy}
                            variant="outline"
                            onClick={() => {
                              setEditingId(null)
                              setErr(null)
                              setMsg(null)
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <Button variant="outline" disabled={busy} onClick={() => startEdit(row)}>
                            Edit
                          </Button>
                          <Button variant="danger" disabled={busy} onClick={() => remove(row.id)}>
                            Delete
                          </Button>
                        </div>
                      )}
                    </Td>
                  </tr>
                )
              })}
            </tbody>
          </Table>

          <div className="text-xs text-neutral-500">
            Tip: Rename seeded dropoffs (“Regional Stockpile”) to real towns you use in Discord callouts.
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
