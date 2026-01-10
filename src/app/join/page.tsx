'use client'

import { useState } from 'react'
import { Button, Card, CardContent, CardHeader, Input, Select, Textarea } from '@/components/ui'

type JoinPayload = {
  discord_user_id: string
  discord_name: string
  timezone: string
  typical_play_times: string
  experience_level: string
  notes: string
}

export default function JoinPage() {
  const [loading, setLoading] = useState(false)
  const [ok, setOk] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const [form, setForm] = useState<JoinPayload>({
    discord_user_id: '',
    discord_name: '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC',
    typical_play_times: '',
    experience_level: 'new',
    notes: '',
  })

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    setOk(null)
    setLoading(true)
    try {
      const res = await fetch('/api/join', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? 'Failed to submit')
      setOk('Application received. An officer will contact you on Discord.')
      setForm((f) => ({ ...f, notes: '', typical_play_times: '' }))
    } catch (e: any) {
      setErr(e?.message ?? 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <Card>
        <CardHeader>
          <div className="text-sm text-neutral-400">Join RSi</div>
          <h1 className="text-2xl font-semibold">Apply to join Reaper Strategic Industries</h1>
          <p className="mt-2 text-sm text-neutral-300">
            Discord-only. Please include your <b>Discord User ID</b> so we can approve you.
          </p>
        </CardHeader>

        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm text-neutral-300">Discord User ID</label>
                <Input
                  placeholder="e.g. 123456789012345678"
                  value={form.discord_user_id}
                  onChange={(e) => setForm({ ...form, discord_user_id: e.target.value.trim() })}
                  required
                />
                <p className="mt-1 text-xs text-neutral-500">
                  Discord → Settings → Advanced → Developer Mode → right-click your profile → Copy User ID
                </p>
              </div>

              <div>
                <label className="mb-1 block text-sm text-neutral-300">Discord name</label>
                <Input
                  placeholder="e.g. Rockefella"
                  value={form.discord_name}
                  onChange={(e) => setForm({ ...form, discord_name: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm text-neutral-300">Timezone</label>
                <Input value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} />
              </div>

              <div>
                <label className="mb-1 block text-sm text-neutral-300">Experience level</label>
                <Select
                  value={form.experience_level}
                  onChange={(e) => setForm({ ...form, experience_level: e.target.value })}
                >
                  <option value="new">New</option>
                  <option value="casual">Casual</option>
                  <option value="experienced">Experienced</option>
                  <option value="veteran">Veteran</option>
                </Select>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm text-neutral-300">Typical play times</label>
              <Input
                placeholder="e.g. Weeknights 7–10pm, weekends"
                value={form.typical_play_times}
                onChange={(e) => setForm({ ...form, typical_play_times: e.target.value })}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm text-neutral-300">Notes (optional)</label>
              <Textarea
                rows={4}
                placeholder="What do you like doing? Gathering / cooking / hauling / trains / boats?"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>

            {err && <div className="rounded-xl border border-red-900/60 bg-red-950/40 p-3 text-sm text-red-100">{err}</div>}
            {ok && <div className="rounded-xl border border-lime-300/30 bg-lime-300/10 p-3 text-sm text-lime-100">{ok}</div>}

            <div className="flex items-center justify-between gap-3 pt-2">
              <a href="/" className="text-sm text-neutral-400 hover:text-neutral-200">
                ← Back
              </a>
              <Button disabled={loading} type="submit">
                {loading ? 'Submitting…' : 'Submit application'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
