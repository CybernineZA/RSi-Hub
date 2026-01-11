import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Badge, Button, Card, cn } from '@/components/ui'
import { createClient } from '@/lib/supabase/server'
import { atLeast, type Role } from '@/lib/rsi/roles'
import { requireMembership } from '@/lib/rsi/session'

const NAV = [
  { href: '/app', label: 'Dashboard' },
  { href: '/app/orders/production', label: 'Production' },
  { href: '/app/tools/calculator', label: 'Cost Calculator' },
  { href: '/app/yard', label: 'Container Yard' },
  { href: '/app/shipping', label: 'Shipping' },
  { href: '/app/war', label: 'War Overview' },
]

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { user, membership } = await requireMembership(supabase)

  const role = (membership.role as Role) || 'member'
  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, discord_name')
    .eq('id', user.id)
    .maybeSingle()

  const name = profile?.display_name ?? profile?.discord_name ?? 'Member'

  const isOfficer = atLeast(role, 'officer')
  const isHigh = atLeast(role, 'high_command')

  return (
    <div className="min-h-screen bg-neutral-950">
      <div className="mx-auto flex max-w-7xl gap-6 px-6 py-6">
        <aside className="hidden w-72 shrink-0 md:block">
          <Card className="sticky top-6 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs text-neutral-500">RSi Hub</div>
                <div className="text-lg font-semibold">{name}</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge className="border-lime-300/30 text-lime-200">{role.replace('_', ' ')}</Badge>
                </div>
              </div>
              <a href="/logout">
                <Button variant="outline" className="px-3 py-2 text-xs">
                  Logout
                </Button>
              </a>
            </div>

            <div className="mt-4 space-y-1">
              {NAV.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  className="block rounded-xl px-3 py-2 text-sm text-neutral-200 hover:bg-neutral-900/60"
                >
                  {n.label}
                </Link>
              ))}
            </div>

            {(isOfficer || isHigh) && (
              <>
                <div className="mt-5 border-t border-neutral-800 pt-4 text-xs font-medium text-neutral-500">
                  Admin
                </div>
                <div className="mt-2 space-y-1">
                  <Link
                    href="/app/admin/recruits"
                    className="block rounded-xl px-3 py-2 text-sm text-neutral-200 hover:bg-neutral-900/60"
                  >
                    Recruits
                  </Link>
                  <Link
                    href="/app/admin/items"
                    className="block rounded-xl px-3 py-2 text-sm text-neutral-200 hover:bg-neutral-900/60"
                  >
                    Items
                  </Link>
                  <Link
                    href="/app/admin/destinations"
                    className="block rounded-xl px-3 py-2 text-sm text-neutral-200 hover:bg-neutral-900/60"
                  >
                    Destinations
                  </Link>
                  {isHigh && (
                    <Link
                      href="/app/admin/war"
                      className="block rounded-xl px-3 py-2 text-sm text-neutral-200 hover:bg-neutral-900/60"
                    >
                      War Settings
                    </Link>
                  )}
                </div>
              </>
            )}
          </Card>
        </aside>

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  )
}
