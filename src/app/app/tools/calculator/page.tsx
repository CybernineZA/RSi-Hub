import { createClient } from '@/lib/supabase/server'
import { requireMembership } from '@/lib/rsi/session'
import CalculatorClient from './calculator-client'

export const dynamic = 'force-dynamic'

export default async function CalculatorPage() {
  const supabase = await createClient()
  await requireMembership(supabase)

  const { data, error } = await supabase
    .from('items')
    .select('id, slug, name, category, unit, crate_size, meta, image_name')
    .order('category', { ascending: true })
    .order('name', { ascending: true })

  if (error) {
    return (
      <div className="p-6">
        <div className="text-sm text-red-300">Failed to load items</div>
        <pre className="mt-3 overflow-auto rounded-2xl border border-red-900/50 bg-red-950/30 p-4 text-xs text-red-200">
          {error.message}
        </pre>
      </div>
    )
  }

  return <CalculatorClient items={(data ?? []) as any[]} />
}
