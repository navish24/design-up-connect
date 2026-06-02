import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''

  // Skip auth if env vars are not configured yet
  if (!supabaseUrl.startsWith('http')) {
    return supabaseResponse
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  // Public routes — always accessible
  if (pathname.startsWith('/login') || pathname.startsWith('/_next') || pathname === '/') {
    return supabaseResponse
  }

  // Onboarding is accessible to any authenticated user (new users have no role yet)
  if (pathname.startsWith('/brand/onboarding')) {
    if (!user) return NextResponse.redirect(new URL('/login', request.url))
    return supabaseResponse
  }

  // Admin — any authenticated user (internal tool, URL is the access control)
  if (pathname.startsWith('/admin')) {
    if (!user) return NextResponse.redirect(new URL('/login', request.url))
    return supabaseResponse
  }

  // No session — redirect to login
  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Fetch user role — if table doesn't exist yet, allow through for testing
  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  // If users table doesn't exist yet (during initial setup), allow all authenticated requests
  if (profileError?.code === '42P01' || profileError?.code === 'PGRST116') {
    return supabaseResponse
  }

  const role = profile?.role

  // Role-based route protection (only enforced if users table exists)
  if (role) {
    if (pathname.startsWith('/organiser') && role !== 'organiser') {
      return NextResponse.redirect(new URL('/login', request.url))
    }
    if (pathname.startsWith('/gate') && role !== 'gate_staff') {
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
