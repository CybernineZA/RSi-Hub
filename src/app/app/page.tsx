import { Card, CardContent, CardHeader, Badge, A } from '@/components/ui'
import { createClient } from '@/lib/supabase/server'
import { requireMembership } from '@/lib/rsi/session'

export default async function AppHome() {
  const supabase = await createClient()
  const { membership } = await requireMembership(supabase)

  const { data: war } = await supabase
    .from('regiments')
    .select('active_war_id, wars:active_war_id(id, name, status)')
    .eq('slug', 'rsi')
    .maybeSingle()

  const activeWar = (war as any)?.wars

  return (
    <div className="space-y-6">
      <div>
        <div className="text-sm text-neutral-400">Dashboard</div>
        <h1 className="text-3xl font-semibold tracking-tight">Operations</h1>
        <p className="mt-2 text-neutral-300">
          Create production orders, fill containers, and dispatch shipments.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <div className="text-sm text-neutral-400">Active war</div>
            <div className="text-xl font-semibold">{activeWar?.name ?? 'Not set'}</div>
            {activeWar?.status && <Badge className="mt-2 w-fit">{activeWar.status}</Badge>}
          </CardHeader>
          <CardContent>
            <div className="text-sm text-neutral-300">
              Destinations are stored per-war. If this is a new war, ask High Command to seed the regions + dropoffs.
            </div>
            <div className="mt-4 text-sm">
              <A href="/app/admin/destinations">Manage destinations</A>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="text-sm text-neutral-400">Quick actions</div>
            <div className="text-xl font-semibold">Start here</div>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div>• Create production order</div>
            <div>• Fill a container for yard</div>
            <div>• Create shipping order</div>
            <div className="pt-2">
              <A href="/app/tools/calculator">Open cost calculator</A>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="text-sm text-neutral-400">Access</div>
            <div className="text-xl font-semibold">Your role</div>
          </CardHeader>
          <CardContent className="text-sm text-neutral-300">
            You are <b>{membership.role}</b>. Admin tools appear automatically for officers and above.
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="text-sm text-neutral-400">Data</div>
          <div className="text-xl font-semibold">FoxholeLogi integration</div>
        </CardHeader>
        <CardContent className="text-sm text-neutral-300">
          Items + costs are synced from FoxholeLogi’s dataset. You can use the built-in calculator, or open the
          original tool for reference.

          <div className="mt-3 flex flex-wrap gap-3 text-sm">
            <A href="/app/tools/calculator">Calculator</A>
            <a
              className="text-lime-200 hover:text-lime-100 underline underline-offset-4 decoration-lime-200/40 hover:decoration-lime-200/80"
              href="https://foxholelogi.com/"
              target="_blank"
              rel="noreferrer"
            >
              Open FoxholeLogi
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
