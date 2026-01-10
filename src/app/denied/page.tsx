import { Button, Card, CardContent, CardHeader } from '@/components/ui'

export default function DeniedPage() {
  return (
    <div className="mx-auto max-w-lg px-6 py-16">
      <Card>
        <CardHeader>
          <div className="text-sm text-neutral-400">Access denied</div>
          <h1 className="text-2xl font-semibold">Application not accepted</h1>
          <p className="mt-2 text-sm text-neutral-300">
            Your Discord account isn’t approved for RSi Hub. If you think this is a mistake, contact an officer in Discord.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <a href="/">
            <Button className="w-full" variant="outline">Back to homepage</Button>
          </a>
        </CardContent>
      </Card>
    </div>
  )
}
