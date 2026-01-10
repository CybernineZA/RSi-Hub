'use client'

import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getDiscordId, getDiscordName } from '@/lib/rsi/discord'
import { Button, Card, CardContent, CardHeader, Input, Select, Textarea } from '@/components/ui'

type JoinPayload = {
  discord_user_id: string
  discord_name: string
  timezone: string
  typical_play_times: string
  experience_level: string
  notes: string
}

type AuthState =
  | { loggedIn: false }
  | { loggedIn: true; discord_id: string | null; discord_name: string | null }

export default function JoinPage() {
  const [loading, setLoading] = useState(false)
  const [ok, setOk] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const [auth, setAuth] = useState<AuthState>({ loggedIn: false })

  const [form, setForm] = useState<JoinPayload>({
    discord_user_id: '',
    discord_name: '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC',
    typical_play_times: '',
    experience_level: 'new',
    notes: '',
  })

  const canAutoFill = useMemo(() => auth.loggedIn && !!(auth as any).discord_id, [auth])

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const supabase = createClient()
        const { data } = await supabase.auth.getUser()
        const user = data?.user
        if (!mounted) return
        if (!user) {
          setAuth({ loggedIn: false })
          return
        }
        const did = getDiscordId(user)
        const dname = getDiscordName(user)
        setAuth({ loggedIn: true, discord_id: did, discord_name: dname })
        if (did) {
          setForm((f) => ({ ...f, discord_user_id: did, discord_name: dname ?? f.discord_name }))
        }
        if (dname) {
          setForm((f) => ({ ...f, discord_name: dname }))
        }
      } catch {
        // ignore
      }
    })()
    return () => {
      mounted = false
    }
  }, [])

  async function signInDiscord() {
    setErr(null)
    try {
      const supabase = createClient()
      const redirectTo = `${window.location.origin}/auth/callback`
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'discord',
        options: { redirectTo },
      })
      if (error) throw error
    } catch (e: any) {
      setErr(e?.message ?? 'Failed to start Discord login')
    }
  }

  async function submit(e: FormEvent) {
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
      const msg =
        data?.status === 'accepted'
          ? 'You are already approved. Redirecting you into the app…'
          : 'Application received. An officer will contact you on Discord.'
      setOk(msg)
      setForm((f) => ({ ...f, notes: '', typical_play_times: '' }))

      // If already accepted, the pending page will bootstrap you into the app.
      window.location.href = '/pending'
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
            Discord-only. Log in with Discord first — we’ll auto-fill your Discord ID so approval is fast and accurate.
          </p>
        </CardHeader>

        <CardContent>
          {!auth.loggedIn ? (
            <div className="space-y-4">
              {err && (
                <div className="rounded-xl border border-red-900/60 bg-red-950/40 p-3 text-sm text-red-100">{err}</div>
              )}
              <Button onClick={signInDiscord} className="w-full">
                Continue with Discord
              </Button>
              <a href="/" className="block text-center text-sm text-neutral-500 hover:text-neutral-300">
                Back to homepage
              </a>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              {/* If we can’t auto-extract the Discord ID for some reason, fall back to manual input */}
              {!canAutoFill ? (
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
              ) : (
                <div className="rounded-2xl border border-neutral-800 bg-neutral-950/40 p-4">
                  <div className="text-sm text-neutral-400">Signed in with Discord</div>
                  <div className="mt-1 text-sm text-neutral-200">
                    <span className="text-neutral-400">User ID:</span> <span className="font-mono">{form.discord_user_id}</span>
                  </div>
                  <div className="mt-1 text-sm text-neutral-200">
                    <span className="text-neutral-400">Name:</span> {form.discord_name || (auth as any).discord_name || '—'}
                  </div>
                </div>
              )}

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

              {err && (
                <div className="rounded-xl border border-red-900/60 bg-red-950/40 p-3 text-sm text-red-100">{err}</div>
              )}
              {ok && (
                <div className="rounded-xl border border-lime-300/30 bg-lime-300/10 p-3 text-sm text-lime-100">{ok}</div>
              )}

              <div className="flex items-center justify-between gap-3 pt-2">
                <a href="/" className="text-sm text-neutral-400 hover:text-neutral-200">
                  ← Back
                </a>
                <Button disabled={loading} type="submit">
                  {loading ? 'Submitting…' : 'Submit application'}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
