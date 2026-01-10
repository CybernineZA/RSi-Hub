import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { updateSession } from '@/lib/supabase/middleware'

const ROLE_RANK: Record<string, number> = {
  recruit: 0,
  member: 1,
  officer: 2,
  high_command: 3,
  commander: 4,
}

export async function middleware(request: NextRequest) {
  const res = await updateSession(request)

  const { pathname } = request.nextUrl
  if (!pathname.startsWith('/app')) return res

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        cookiesToSet.forEach(({ name, value, options }) => res.cookies.set(name, value, options))
      },
    },
  })

  const { data: userRes } = await supabase.auth.getUser()
  const user = userRes?.user
  if (!user) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = '/login'
    redirectUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(redirectUrl)
  }

  const { data: membership } = await supabase
    .from('memberships')
    .select('role')
    .eq('profile_id', user.id)
    .maybeSingle()

  if (!membership || ROLE_RANK[membership.role] < ROLE_RANK.member) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = '/pending'
    return NextResponse.redirect(redirectUrl)
  }

  return res
}

export const config = {
  matcher: ['/app/:path*'],
}
