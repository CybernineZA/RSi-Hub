import { createClient } from '@/lib/supabase/server'
import { requireMembership } from '@/lib/rsi/session'
import { atLeast, type Role } from '@/lib/rsi/roles'
import { Card, CardHeader, CardTitle, CardContent, A } from '@/components/ui'
import ItemsClient from './items-client'

export const dynamic = 'force-dynamic'

export default async function ItemsAdminPage() {
  const supabase = await createClient()
  const { membership } = await requireMembership(supabase)

  const role = membership.role as Role
  const canSync = atLeast(role, 'officer')

  const { count } = await supabase.from('items').select('id', { count: 'exact', head: true })

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Items Library</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-neutral-300">
          <div>
            This pulls an up-to-date item list for dropdowns in Production / Yard / Shipping.
          </div>
          <div className="text-neutral-400">
            Current items in DB: <span className="text-neutral-200">{count ?? 0}</span>
          </div>
          <div className="text-xs text-neutral-500">
            Source URL:{' '}
            <span className="font-mono">{process.env.FOXHOLE_ITEM_API_URL || 'https://foxholelogi.com/assets/foxhole.json'}</span>
          </div>
          <div className="text-sm">
            <A href="/app/tools/calculator">Open cost calculator</A>
          </div>
        </CardContent>
      </Card>

      <ItemsClient canSync={canSync} />
    </div>
  )
}
