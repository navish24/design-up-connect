'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import {
  LayoutDashboard, Package, QrCode, Users, LogOut,
  ChevronRight, FolderOpen, Briefcase, Clock,
} from 'lucide-react'

const navItems = [
  { href: '/brand',                 label: 'Dashboard',        icon: LayoutDashboard, exact: true },
  { href: '/brand/catalogue',       label: 'Catalogue',        icon: Package },
  { href: '/brand/collections',     label: 'Collections',      icon: FolderOpen },
  { href: '/brand/projects',        label: 'Projects',         icon: Briefcase },
  { href: '/brand/past-exhibitions',label: 'Past Exhibitions', icon: Clock },
  { href: '/brand/people',          label: 'People at Brand',  icon: Users },
  { href: '/brand/qr',              label: 'Brand QR',         icon: QrCode },
]

export function BrandSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  function isActive(href: string, exact?: boolean) {
    return exact ? pathname === href : pathname.startsWith(href)
  }

  return (
    <aside className="fixed top-0 left-0 h-full w-60 bg-[var(--surface)] border-r border-[var(--border)] flex flex-col z-40">

      {/* Wordmark */}
      <div className="px-5 py-5 border-b border-[var(--border)]">
        <div className="text-xl font-bold tracking-tight text-[var(--text)]">Designup</div>
        <div className="text-xs font-semibold tracking-widest uppercase text-[var(--accent)] mt-0.5">Brand Dashboard</div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-3 flex flex-col gap-0.5 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon, exact }) => {
          const active = isActive(href, exact)
          return (
            <Link
              key={href}
              href={href}
              className={[
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all',
                active
                  ? 'bg-[var(--accent-dim)] text-[var(--accent)]'
                  : 'text-[var(--text2)] hover:text-[var(--text)] hover:bg-[var(--surface2)]',
              ].join(' ')}
            >
              <Icon size={16} className="flex-shrink-0" />
              {label}
              {active && <ChevronRight size={12} className="ml-auto opacity-50" />}
            </Link>
          )
        })}

        <div className="h-px bg-[var(--border)] my-3" />
        <p className="px-3 text-xs font-bold uppercase tracking-widest text-[var(--text3)] mb-1">
          Exhibitions
        </p>
        <Link
          href="/brand"
          className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-[var(--text3)] hover:text-[var(--text2)] transition-colors"
        >
          View all
        </Link>
      </nav>

      {/* Bottom controls */}
      <div className="px-3 pb-4 border-t border-[var(--border)] pt-3 flex flex-col gap-0.5">
        <ThemeToggle />
        <button
          onClick={signOut}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-[var(--text3)] hover:text-[var(--red)] hover:bg-[var(--red-dim)] transition-all w-full"
        >
          <LogOut size={16} className="flex-shrink-0" />
          Sign out
        </button>
      </div>
    </aside>
  )
}
