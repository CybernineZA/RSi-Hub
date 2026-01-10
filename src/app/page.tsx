import { A, Badge, Button, Card, CardContent, CardHeader } from '@/components/ui'

export default function HomePage() {
  return (
    <div className="relative min-h-screen rsi-grid">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-lime-400/10 via-transparent to-transparent" />

      <header className="relative mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-2xl border border-neutral-800 bg-neutral-950/60">
            <span className="text-sm font-semibold text-lime-200">RSi</span>
          </div>
          <div>
            <div className="text-sm text-neutral-400">Reaper Strategic Industries</div>
            <div className="text-lg font-semibold tracking-tight">RSi Hub</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a href="/join">
            <Button variant="outline">Apply to join</Button>
          </a>
          <a href="/login">
            <Button>Login with Discord</Button>
          </a>
        </div>
      </header>

      <main className="relative mx-auto max-w-6xl px-6 pb-16 pt-10">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
          <div>
            <Badge className="border-lime-300/30 text-lime-200">Foxhole logistics regiment</Badge>
            <h1 className="mt-4 text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
              Full-cover logistics, from <span className="text-lime-200">gather</span> → refine → crate → containerize →
              deliver.
            </h1>
            <p className="mt-4 max-w-xl text-neutral-300">
              Plan production, manage the container yard, and dispatch shipments to contested frontlines. Discord-only
              sign-in, officer-controlled approvals.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <a href="/join">
                <Button>Apply to join</Button>
              </a>
              <a href="/login">
                <Button variant="outline">Member login</Button>
              </a>
              <a href="/app" className="hidden">
                <Button variant="ghost">Go to app</Button>
              </a>
            </div>

            <div className="mt-6 text-sm text-neutral-400">
              Already applied? You’ll be able to login only after an officer approves your application.
            </div>
          </div>

          <Card className="overflow-hidden">
            <CardHeader>
              <div className="text-sm text-neutral-400">What you get</div>
              <div className="text-xl font-semibold">Operations dashboard</div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3 text-sm text-neutral-300">
                <li>• Production work orders (single crate or full container)</li>
                <li>• Container yard inventory with contents</li>
                <li>• Shipping orders + delivery log per war</li>
                <li>• Destinations seeded per region + editable town dropoffs</li>
                <li>• War reset tools for officers</li>
              </ul>

              <div className="mt-6 rounded-2xl border border-neutral-800 bg-neutral-950/40 p-4">
                <div className="text-xs text-neutral-500">Tip</div>
                <div className="text-sm">
                  Keep your Discord User ID handy for the join form. You can copy it from Discord (Developer Mode).
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mt-12 text-sm text-neutral-500">
          Need help? Open an officer ticket in Discord, or check the README in the repo.
        </div>
      </main>

      <footer className="relative mx-auto max-w-6xl px-6 pb-10 text-xs text-neutral-600">
        Built for RSi • Discord-only • Supabase
      </footer>
    </div>
  )
}
