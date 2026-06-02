'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { LayoutDashboard, Calendar, LogOut, ChevronRight } from 'lucide-react'

const navItems = [
  { href: '/organiser', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/organiser/exhibitions', label: 'Exhibitions', icon: Calendar },
]

export function OrganiserSidebar() {
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
    <aside className="fixed top-0 left-0 h-full w-56 bg-[var(--surface)] border-r border-[var(--border)] flex flex-col z-40">
      <div className="px-5 py-5 border-b border-[var(--border)]">
        <div className="text-base font-bold text-[var(--accent)]">DESIGNUP</div>
        <div className="text-xs text-[var(--text3)] mt-0.5">Organiser Dashboard</div>
      </div>
      <nav className="flex-1 py-4 px-3 flex flex-col gap-0.5">
        {navItems.map(({ href, label, icon: Icon, exact }) => {
          const active = isActive(href, exact)
          return (
            <Link
              key={href} href={href}
              className={[
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all',
                active ? 'bg-[var(--accent-dim)] text-[var(--accent)]' : 'text-[var(--text2)] hover:text-[var(--text)] hover:bg-[var(--surface2)]',
              ].join(' ')}
            >
              <Icon size={16} className="flex-shrink-0" />
              {label}
              {active && <ChevronRight size={12} className="ml-auto opacity-50" />}
            </Link>
          )
        })}
      </nav>
      <div className="px-3 py-4 border-t border-[var(--border)]">
        <button
          onClick={signOut}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-[var(--text3)] hover:text-[var(--red)] hover:bg-[var(--red-dim)] transition-all w-full"
        >
          <LogOut size={16} /> Sign out
        </button>
      </div>
    </aside>
  )
}
