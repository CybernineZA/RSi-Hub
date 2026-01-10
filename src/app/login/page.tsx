'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button, Card, CardContent, CardHeader } from '@/components/ui'

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function signInDiscord() {
    setLoading(true)
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
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-lg px-6 py-16">
      <Card>
        <CardHeader>
          <div className="text-sm text-neutral-400">RSi Hub</div>
          <h1 className="text-2xl font-semibold">Login</h1>
          <p className="mt-2 text-sm text-neutral-300">
            Discord-only. You can login only after an officer approves your join application.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {err && (
            <div className="rounded-xl border border-red-900/60 bg-red-950/40 p-3 text-sm text-red-100">{err}</div>
          )}
          <Button onClick={signInDiscord} disabled={loading} className="w-full">
            {loading ? 'Opening Discord…' : 'Continue with Discord'}
          </Button>

          <div className="text-center text-sm text-neutral-500">
            Not approved yet? <a className="text-lime-200 underline underline-offset-4" href="/join">Apply to join</a>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
