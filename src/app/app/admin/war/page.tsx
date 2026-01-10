import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { Badge, Button, Card, CardContent, CardHeader, Divider, Input } from '@/components/ui'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { atLeast, type Role } from '@/lib/rsi/roles'
import { requireMembership } from '@/lib/rsi/session'
import { FOXHOLE_REGIONS, FOXHOLE_ISLANDS } from '@/lib/foxhole/regions'

export default async function WarAdminPage() {
  const supabase = await createClient()
  const { membership } = await requireMembership(supabase)
  const role = membership.role as Role

  if (!atLeast(role, 'high_command')) {
    return (
      <Card>
        <CardHeader>
          <div className="text-sm text-neutral-400">Admin</div>
          <div className="text-2xl font-semibold">War Settings</div>
        </CardHeader>
        <CardContent className="text-sm text-neutral-300">
          You need <b>High Command</b> (or higher) to manage wars.
        </CardContent>
      </Card>
    )
  }

  const { data: regiment } = await supabase
    .from('regiments')
    .select('id, active_war_id, active:active_war_id(id, name, status)')
    .eq('slug', 'rsi')
    .maybeSingle()

  const { data: wars } = await supabase
    .from('wars')
    .select('id, name, status, started_at, ended_at')
    .order('started_at', { ascending: false })
    .limit(20)

  async function createAndActivate(formData: FormData) {
    'use server'
    const name = String(formData.get('name') ?? '').trim()
    if (!name) return

    // Re-check permissions server-side (never rely on UI-only checks)
    const supabase = await createClient()
    const { membership } = await requireMembership(supabase)
    const role = membership.role as Role
    if (!atLeast(role, 'high_command')) throw new Error('Forbidden')

    // Use admin client for inserts/updates that are protected by RLS.
    // We still enforce authorization above.
    const admin = createAdminClient()

    const { data: created, error: wErr } = await admin
      .from('wars')
      .insert({ regiment_id: membership.regiment_id, name, status: 'active' })
      .select('id')
      .single()
    if (wErr) throw new Error(wErr.message)

    const { error: rErr } = await admin
      .from('regiments')
      .update({ active_war_id: created.id })
      .eq('id', membership.regiment_id)
    if (rErr) throw new Error(rErr.message)

    // Ensure a default container yard exists for this war
    const { data: yardLoc, error: ylErr } = await admin
      .from('locations')
      .insert({
        war_id: created.id,
        name: 'RSi Container Yard',
        type: 'yard',
        region: null,
        grid_ref: null,
        notes: 'Default container yard (auto-created)',
      })
      .select('id')
      .single()

    if (ylErr) throw new Error(ylErr.message)

    const { error: yErr } = await admin.from('yards').insert({
      war_id: created.id,
      name: 'Main Yard',
      location_id: yardLoc.id,
    })

    if (yErr) throw new Error(yErr.message)

    revalidatePath('/app/admin/war')
    redirect('/app/admin/war')
  }

  async function setActive(formData: FormData) {
    'use server'
    const warId = String(formData.get('war_id') ?? '')
    if (!warId) return

    const supabase = await createClient()
    const { membership } = await requireMembership(supabase)
    const role = membership.role as Role
    if (!atLeast(role, 'high_command')) throw new Error('Forbidden')

    const admin = createAdminClient()
    const { error } = await admin.from('regiments').update({ active_war_id: warId }).eq('id', membership.regiment_id)
    if (error) throw new Error(error.message)
    revalidatePath('/app/admin/war')
  }

  async function seedDestinations() {
    'use server'

    const supabase = await createClient()
    const { membership } = await requireMembership(supabase)
    const role = membership.role as Role
    if (!atLeast(role, 'high_command')) throw new Error('Forbidden')

    const admin = createAdminClient()
    const { data: reg, error: regErr } = await admin
      .from('regiments')
      .select('active_war_id')
      .eq('id', membership.regiment_id)
      .maybeSingle()
    if (regErr) throw new Error(regErr.message)

    const warId = reg?.active_war_id
    if (!warId) throw new Error('No active war set')

    // Insert default dropoffs per region (skip if already exists)
    const { data: existing, error: exErr } = await admin
      .from('locations')
      .select('id, war_id, name, region')
      .eq('war_id', warId)
    if (exErr) throw new Error(exErr.message)

    const existingKey = new Set((existing ?? []).map((l: any) => `${l.region}::${l.name}`))

    const rows: any[] = []
    for (const region of FOXHOLE_REGIONS) {
      const base = [
        { name: 'Regional Stockpile', type: 'depot' as const },
        { name: 'Forward Depot', type: 'front' as const },
      ]
      const extras = FOXHOLE_ISLANDS.has(region)
        ? [{ name: 'Seaport', type: 'seaport' as const }]
        : []

      for (const loc of [...base, ...extras]) {
        const key = `${region}::${loc.name}`
        if (existingKey.has(key)) continue
        rows.push({
          war_id: warId,
          region,
          name: loc.name,
          type: loc.type,
          notes: 'Seeded default (edit as needed)',
        })
      }
    }

    if (rows.length) {
      const { error } = await admin.from('locations').insert(rows)
      if (error) throw new Error(error.message)
    }

    revalidatePath('/app/admin/war')
    revalidatePath('/app/admin/destinations')
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="text-sm text-neutral-400">Admin</div>
        <h1 className="text-3xl font-semibold tracking-tight">War Settings</h1>
        <p className="mt-2 text-neutral-300">
          Set the active war, then seed regions + default dropoffs. Officers can edit town dropoffs after seeding.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="text-sm text-neutral-400">Active war</div>
          <div className="flex items-center justify-between gap-3">
            <div className="text-xl font-semibold">{(regiment as any)?.active?.name ?? 'Not set'}</div>
            {(regiment as any)?.active?.status && <Badge>{(regiment as any).active.status}</Badge>}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <form action={createAndActivate} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label className="mb-1 block text-sm text-neutral-300">Create new war</label>
              <Input name="name" placeholder="e.g. War 115 — Winter Push" required />
            </div>
            <Button type="submit">Create & set active</Button>
          </form>

          <Divider />

          <form action={setActive} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label className="mb-1 block text-sm text-neutral-300">Switch active war</label>
              <select
                name="war_id"
                className="w-full rounded-xl border border-neutral-800 bg-neutral-950/40 px-3 py-2.5 text-sm text-neutral-100 outline-none focus:border-lime-300/60 focus:ring-2 focus:ring-lime-300/20"
                defaultValue={(regiment as any)?.active_war_id ?? ''}
              >
                <option value="" disabled>
                  Select war…
                </option>
                {(wars ?? []).map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({w.status})
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit" variant="outline">
              Set active
            </Button>
          </form>

          <Divider />

          <form action={seedDestinations}>
            <Button type="submit">Seed regions + default dropoffs</Button>
            <p className="mt-2 text-xs text-neutral-500">
              This creates default dropoffs per region for the active war. You can rename/add town dropoffs under Admin → Destinations.
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
