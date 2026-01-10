'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardHeader, CardTitle, CardContent, Button } from '@/components/ui'

export default function ItemsClient({ canSync }: { canSync: boolean }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function sync() {
    if (!canSync) return
    setBusy(true)
    setMsg(null)
    try {
      const res = await fetch('/api/items/sync', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Sync failed')
      setMsg(`Synced ${data.upserted} items`)
      router.refresh()
    } catch (e: any) {
      setMsg(e?.message ?? String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Sync</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-sm text-neutral-400">
          You only need to do this once after a fresh install, and again if you want to refresh item names/categories.
        </div>
        <Button disabled={!canSync || busy} onClick={sync}>
          {busy ? 'Syncing…' : 'Sync items from API'}
        </Button>
        {msg && <div className="text-sm text-neutral-200">{msg}</div>}
        {!canSync && <div className="text-xs text-neutral-500">Officer+ required.</div>}
      </CardContent>
    </Card>
  )
}
