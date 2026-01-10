'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button, Card, CardContent, CardHeader } from '@/components/ui'

type BootRes =
  | { loggedIn: false }
  | {
      loggedIn: true
      status?: 'none' | 'pending' | 'accepted' | 'rejected'
      bootstrapped?: boolean
      error?: string
    }

export default function PendingPage() {
  const [loading, setLoading] = useState(false)
  const [state, setState] = useState<BootRes | null>(null)

  const title = useMemo(() => {
    if (!state) return "Checking your access…"
    if (!state.loggedIn) return 'Login required'
    if (state.status === 'accepted') return 'Approved!'
    if (state.status === 'rejected') return 'Not approved'
    if (state.status === 'none') return 'Application needed'
    return 'Approval pending'
  }, [state])

  const desc = useMemo(() => {
    if (!state) return 'Hang on — we’re checking your join status.'
    if (!state.loggedIn) return 'Please log in with Discord to continue.'
    if (state.status === 'accepted') return 'You’re approved. Redirecting you into the app…'
    if (state.status === 'rejected') return 'Your application was rejected. If you think this is a mistake, contact an officer.'
    if (state.status === 'none') return 'We couldn’t find a join application for your Discord account yet.'
    if (state.error) return state.error
    return 'An officer still needs to approve your join application.'
  }, [state])

  async function check() {
    setLoading(true)
    try {
      const res = await fetch('/api/bootstrap', { method: 'POST' })
      const data = (await res.json()) as BootRes
      setState(data)
      if ((data as any)?.status === 'accepted') {
        // Give the cookie/session a moment to settle, then enter the app.
        window.location.href = '/app'
      }
    } catch (e: any) {
      setState({ loggedIn: true, error: e?.message ?? 'Failed to check status' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void check()
    // also re-check every 15s while the tab is open
    const t = setInterval(check, 15000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="mx-auto max-w-lg px-6 py-16">
      <Card>
        <CardHeader>
          <div className="text-sm text-neutral-400">Access</div>
          <h1 className="text-2xl font-semibold">{title}</h1>
          <p className="mt-2 text-sm text-neutral-300">{desc}</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {!state || (state as any).status === 'pending' ? (
            <Button className="w-full" onClick={check} disabled={loading}>
              {loading ? 'Checking…' : 'Check approval again'}
            </Button>
          ) : null}

          {state && !(state as any).loggedIn ? (
            <a href="/login">
              <Button className="w-full">Go to login</Button>
            </a>
          ) : null}

          {state && (state as any).status === 'none' ? (
            <a href="/join">
              <Button className="w-full">Apply to join</Button>
            </a>
          ) : null}

          <a href="/" className="block text-center text-sm text-neutral-500 hover:text-neutral-300">
            Back to homepage
          </a>
        </CardContent>
      </Card>
    </div>
  )
}
