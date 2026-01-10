import { Button, Card, CardContent, CardHeader } from '@/components/ui'

export default function PendingPage() {
  return (
    <div className="mx-auto max-w-lg px-6 py-16">
      <Card>
        <CardHeader>
          <div className="text-sm text-neutral-400">Access pending</div>
          <h1 className="text-2xl font-semibold">You’re not approved yet</h1>
          <p className="mt-2 text-sm text-neutral-300">
            An officer needs to approve your join application before Discord login will work.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <a href="/join">
            <Button className="w-full">Apply to join</Button>
          </a>
          <a href="/" className="block text-center text-sm text-neutral-500 hover:text-neutral-300">
            Back to homepage
          </a>
        </CardContent>
      </Card>
    </div>
  )
}
