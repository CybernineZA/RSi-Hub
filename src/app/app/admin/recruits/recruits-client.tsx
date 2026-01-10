'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input, Textarea } from '@/components/ui'

type AppRow = {
  id: string
  created_at: string
  status: 'pending' | 'accepted' | 'rejected'
  discord_user_id: string
  discord_name: string
  timezone: string | null
  typical_play_times: string | null
  experience_level: string | null
  notes: string | null
  reviewed_at: string | null
  review_notes: string | null
}

function StatusBadge({ status }: { status: AppRow['status'] }) {
  const map: Record<AppRow['status'], { label: string; tone: 'default' | 'outline' }> = {
    pending: { label: 'PENDING', tone: 'outline' },
    accepted: { label: 'ACCEPTED', tone: 'default' },
    rejected: { label: 'REJECTED', tone: 'outline' },
  }
  const cfg = map[status] ?? { label: String(status).toUpperCase(), tone: 'outline' }
  return <Badge variant={cfg.tone}>{cfg.label}</Badge>
}

export default function RecruitsClient({ apps, canReview }: { apps: AppRow[]; canReview: boolean }) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({})

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return apps
    return apps.filter((a) => {
      return (
        a.discord_user_id.toLowerCase().includes(q) ||
        a.discord_name.toLowerCase().includes(q) ||
        String(a.notes ?? '').toLowerCase().includes(q) ||
        a.status.toLowerCase().includes(q)
      )
    })
  }, [apps, query])

  async function setStatus(appId: string, status: AppRow['status']) {
    if (!canReview) return
    setBusyId(appId)
    try {
      const res = await fetch(`/api/recruit-apps/${appId}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status, notes: noteDraft[appId] ?? null }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Request failed')
      router.refresh()
    } catch (e: any) {
      alert(e?.message ?? String(e))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <CardTitle className="text-base">Applications ({filtered.length})</CardTitle>
        <div className="w-full md:w-80">
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by Discord ID, name, status…" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {filtered.length === 0 ? (
          <div className="text-sm text-neutral-400">No applications found.</div>
        ) : (
          filtered.map((a) => (
            <div key={a.id} className="rounded-2xl border border-neutral-800 bg-neutral-950/30 p-4 space-y-3">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={a.status} />
                  <span className="text-sm text-neutral-200 font-medium">{a.discord_name}</span>
                  <span className="text-xs text-neutral-500">({a.discord_user_id})</span>
                  <span className="text-xs text-neutral-500">• {new Date(a.created_at).toLocaleString()}</span>
                </div>
                {canReview && (
                  <div className="flex flex-wrap gap-2">
                    <Button disabled={busyId === a.id || a.status === 'accepted'} onClick={() => setStatus(a.id, 'accepted')}>
                      Accept
                    </Button>
                    <Button
                      disabled={busyId === a.id || a.status === 'rejected'}
                      variant="outline"
                      onClick={() => setStatus(a.id, 'rejected')}
                    >
                      Reject
                    </Button>
                    <Button
                      disabled={busyId === a.id || a.status === 'pending'}
                      variant="ghost"
                      onClick={() => setStatus(a.id, 'pending')}
                    >
                      Reset
                    </Button>
                  </div>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-neutral-800 bg-neutral-950/40 p-3">
                  <div className="text-xs text-neutral-500">Timezone</div>
                  <div className="text-sm text-neutral-200">{a.timezone ?? '—'}</div>
                </div>
                <div className="rounded-xl border border-neutral-800 bg-neutral-950/40 p-3">
                  <div className="text-xs text-neutral-500">Play times</div>
                  <div className="text-sm text-neutral-200">{a.typical_play_times ?? '—'}</div>
                </div>
                <div className="rounded-xl border border-neutral-800 bg-neutral-950/40 p-3">
                  <div className="text-xs text-neutral-500">Experience</div>
                  <div className="text-sm text-neutral-200">{a.experience_level ?? '—'}</div>
                </div>
              </div>

              {a.notes && (
                <div className="rounded-xl border border-neutral-800 bg-neutral-950/40 p-3">
                  <div className="text-xs text-neutral-500">Notes</div>
                  <div className="mt-1 text-sm text-neutral-200 whitespace-pre-wrap">{a.notes}</div>
                </div>
              )}

              {canReview && (
                <div className="space-y-2">
                  <div className="text-xs text-neutral-500">Officer notes (optional)</div>
                  <Textarea
                    rows={2}
                    value={noteDraft[a.id] ?? a.review_notes ?? ''}
                    onChange={(e) => setNoteDraft((s) => ({ ...s, [a.id]: e.target.value }))}
                    placeholder="Notes for this applicant (optional)…"
                  />
                  {a.reviewed_at && (
                    <div className="text-xs text-neutral-500">Last review: {new Date(a.reviewed_at).toLocaleString()}</div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}
