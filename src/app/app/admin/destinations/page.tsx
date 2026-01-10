import { createClient } from '@/lib/supabase/server'
import { requireMembership } from '@/lib/rsi/session'
import { atLeast, type Role } from '@/lib/rsi/roles'
import { Card, CardContent, CardHeader } from '@/components/ui'
import DestinationsClient from './ui'

export default async function DestinationsPage() {
  const supabase = await createClient()
  const { membership } = await requireMembership(supabase)
  const role = membership.role as Role

  if (!atLeast(role, 'officer')) {
    return (
      <Card>
        <CardHeader>
          <div className="text-sm text-neutral-400">Admin</div>
          <div className="text-2xl font-semibold">Destinations</div>
        </CardHeader>
        <CardContent className="text-sm text-neutral-300">
          You need <b>Officer</b> (or higher) to edit destinations.
        </CardContent>
      </Card>
    )
  }

  const { data: regiment } = await supabase
    .from('regiments')
    .select('active_war_id, active:active_war_id(id, name)')
    .eq('slug', 'rsi')
    .maybeSingle()

  const warId = regiment?.active_war_id
  const warName = (regiment as any)?.active?.name ?? null

  const { data: locations } = warId
    ? await supabase
        .from('locations')
        .select('id, war_id, name, type, region, grid_ref, notes, created_at')
        .eq('war_id', warId)
        .order('region', { ascending: true })
        .order('name', { ascending: true })
    : { data: [] as any[] }

  return <DestinationsClient warId={warId ?? null} warName={warName} initialLocations={locations ?? []} />
}
