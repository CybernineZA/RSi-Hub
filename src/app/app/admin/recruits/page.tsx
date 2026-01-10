import { createClient } from '@/lib/supabase/server'
import { requireMembership } from '@/lib/rsi/session'
import { atLeast, type Role } from '@/lib/rsi/roles'
import { Card, CardHeader, CardTitle, CardContent, Badge } from '@/components/ui'
import RecruitsClient from './recruits-client'

export const dynamic = 'force-dynamic'

export default async function RecruitsAdminPage() {
  const supabase = await createClient()
  const { membership } = await requireMembership(supabase)

  const role = membership.role as Role
  const isOfficer = atLeast(role, 'officer')

  const { data: apps, error } = await supabase
    .from('recruit_applications')
    .select('id, created_at, status, discord_user_id, discord_name, timezone, typical_play_times, experience_level, notes, reviewed_at, review_notes')
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Recruit Applications</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-neutral-300">
          <div>
            Review new applications. Once approved, the user can sign in with Discord and will be provisioned automatically.
          </div>
          {!isOfficer && (
            <div className="mt-2">
              <Badge>Read-only</Badge>
              <span className="ml-2 text-neutral-400">You need Officer+ to approve/deny.</span>
            </div>
          )}
        </CardContent>
      </Card>

      {error ? (
        <Card>
          <CardHeader>
            <CardTitle>Error</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-red-300">{error.message}</CardContent>
        </Card>
      ) : (
        <RecruitsClient apps={apps ?? []} canReview={isOfficer} />
      )}
    </div>
  )
}
