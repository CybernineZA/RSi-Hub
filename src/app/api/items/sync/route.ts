import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireMembership } from '@/lib/rsi/session'
import { atLeast, type Role } from '@/lib/rsi/roles'

function json(data: any, status = 200) {
  return NextResponse.json(data, { status })
}

// FoxholeLogi publishes a public JSON file with item definitions.
const DEFAULT_SOURCE_URL = 'https://foxholelogi.com/assets/foxhole.json'

function slugify(input: string) {
  return input
    .toLowerCase()
    .replace(/\.png$/i, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

function normalizeUnit(category?: string, itemClass?: string): 'crate' | 'item' | 'vehicle' {
  const c = (category ?? '').toLowerCase()
  const cls = (itemClass ?? '').toLowerCase()

  if (c.includes('vehicle') || c.includes('vehicles') || cls.includes('vehicle') || cls.includes('tank')) {
    return 'vehicle'
  }

  return 'crate'
}

export async function POST() {
  const supabase = await createClient()
  const { membership } = await requireMembership(supabase)

  const role = membership.role as Role
  if (!atLeast(role, 'officer')) return json({ error: 'Forbidden' }, 403)

  const url = (process.env.FOXHOLE_ITEM_API_URL || DEFAULT_SOURCE_URL).trim()

  let raw: any
  try {
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return json({ error: `Fetch failed (${res.status})`, details: text.slice(0, 200) }, 400)
    }
    raw = await res.json()
  } catch (e: any) {
    return json({ error: `Fetch failed: ${String(e?.message ?? e)}` }, 400)
  }

  // foxhole.json is usually an array; older sources sometimes return { items: [...] }
  const list = Array.isArray(raw) ? raw : Array.isArray(raw?.items) ? raw.items : []
  if (!Array.isArray(list) || list.length === 0) return json({ error: 'No items returned by source' }, 400)

  const rows = list
    .map((it: any) => {
      const name = String(it?.itemName ?? it?.name ?? '').trim()
      if (!name) return null

      const category = String(it?.itemCategory ?? it?.category ?? it?.categoryName ?? 'Unknown').trim() || 'Unknown'
      const imgName = String(it?.imgName ?? it?.imageName ?? it?.image_name ?? '').trim()

      const slugSource = imgName || name
      const slug = slugify(slugSource)
      if (!slug) return null

      const unit = normalizeUnit(category, String(it?.itemClass ?? it?.className ?? it?.class ?? ''))

      const crateSize = Number(it?.numberProduced ?? it?.amountProduced ?? it?.crateSize ?? it?.crate_size ?? NaN)
      const crate_size = Number.isFinite(crateSize) && crateSize > 1 ? Math.floor(crateSize) : null

      return {
        slug,
        name,
        category,
        unit,
        crate_size,
        // slot_count exists in schema; keep default 1 unless you later model this.
        slot_count: 1,
        is_active: true,
        // Store the raw record for later enrichment.
        meta: it,
      }
    })
    .filter(Boolean) as any[]

  // Deduplicate by slug
  const dedup = new Map<string, any>()
  for (const r of rows) dedup.set(r.slug, r)
  const finalRows = Array.from(dedup.values())

  const admin = createAdminClient()

  const { error } = await admin.from('items').upsert(finalRows, { onConflict: 'slug' })
  if (error) return json({ error: error.message }, 400)

  return json({ ok: true, upserted: finalRows.length, source: url })
}
