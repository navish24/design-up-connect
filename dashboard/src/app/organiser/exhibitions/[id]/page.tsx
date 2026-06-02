import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { Users, ScanLine, BarChart2, MapPin, Calendar, ChevronRight } from 'lucide-react'

interface Props { params: Promise<{ id: string }> }

export default async function ExhibitionDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const { data: ex } = await supabase
    .from('exhibitions')
    .select('*')
    .eq('id', id)
    .single()

  if (!ex) notFound()

  const now = new Date().toISOString().split('T')[0]
  function getState() {
    if (ex.start_date > now) return { label: 'Upcoming', variant: 'accent' as const }
    if (ex.end_date >= now) return { label: 'Active', variant: 'green' as const }
    return { label: 'Ended', variant: 'neutral' as const }
  }
  const { label, variant } = getState()

  // Stats
  const [
    { count: totalBrands },
    { count: activeBrands },
    { count: totalEntries },
    { count: totalScans },
  ] = await Promise.all([
    supabase.from('exhibition_brands').select('*', { count: 'exact', head: true }).eq('exhibition_id', id),
    supabase.from('exhibition_brands').select('*', { count: 'exact', head: true }).eq('exhibition_id', id).eq('status', 'active'),
    supabase.from('gate_entries').select('*', { count: 'exact', head: true }).eq('exhibition_id', id),
    supabase.from('visitor_scans').select('*', { count: 'exact', head: true }).eq('exhibition_id', id),
  ])

  // Brand leaderboard (top 5 by scan count)
  const { data: leaderboard } = await supabase
    .from('visitor_scans')
    .select('brand_id, brands(name)')
    .eq('exhibition_id', id)

  const brandCounts: Record<string, { name: string; count: number }> = {}
  for (const scan of leaderboard ?? []) {
    const bid = scan.brand_id
    const name = (scan.brands as unknown as { name: string } | null)?.name ?? bid
    if (!brandCounts[bid]) brandCounts[bid] = { name, count: 0 }
    brandCounts[bid].count++
  }
  const topBrands = Object.values(brandCounts)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  const maxCount = topBrands[0]?.count ?? 1

  const stats = [
    { label: 'Total Brands', value: totalBrands ?? 0, icon: Users, sub: `${activeBrands ?? 0} active` },
    { label: 'Gate Entries', value: totalEntries ?? 0, icon: ScanLine, sub: 'visitor check-ins' },
    { label: 'Rep Scans', value: totalScans ?? 0, icon: BarChart2, sub: 'lead captures' },
  ]

  const subNavItems = [
    { href: `/organiser/exhibitions/${id}/brands`, label: 'Brands' },
    { href: `/organiser/exhibitions/${id}/passes`, label: 'Passes' },
    { href: `/organiser/exhibitions/${id}/report`, label: 'Report' },
  ]

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <Link href="/organiser/exhibitions" className="text-xs text-[var(--text3)] hover:text-[var(--accent)] transition-colors mb-3 inline-block">
          ← Exhibitions
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold text-[var(--text)]">{ex.name}</h1>
              <Badge label={label} variant={variant} />
            </div>
            <div className="flex items-center gap-4 text-xs text-[var(--text3)]">
              <span className="flex items-center gap-1"><MapPin size={11} /> {ex.venue}, {ex.city}</span>
              <span className="flex items-center gap-1">
                <Calendar size={11} />
                {new Date(ex.start_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                {' – '}
                {new Date(ex.end_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Sub-nav */}
      <div className="flex gap-1 mb-8 border-b border-[var(--border)]">
        {subNavItems.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className="px-4 py-2.5 text-sm font-medium text-[var(--text3)] hover:text-[var(--text)] transition-colors"
          >
            {item.label}
          </Link>
        ))}
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {stats.map(s => (
          <Card key={s.label} className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--text3)] font-medium uppercase tracking-wider">{s.label}</span>
              <s.icon size={14} className="text-[var(--text3)]" />
            </div>
            <div className="text-3xl font-bold text-[var(--text)] tabular-nums">{s.value.toLocaleString()}</div>
            <div className="text-xs text-[var(--text3)]">{s.sub}</div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Brand leaderboard */}
        <Card>
          <h3 className="text-sm font-bold text-[var(--text)] mb-4">Top Brands by Scans</h3>
          {topBrands.length === 0 ? (
            <p className="text-xs text-[var(--text3)] py-4 text-center">No scan data yet</p>
          ) : (
            <div className="flex flex-col gap-3">
              {topBrands.map((b, i) => (
                <div key={i} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[var(--text2)] truncate">{b.name}</span>
                    <span className="text-[var(--text3)] tabular-nums ml-2">{b.count}</span>
                  </div>
                  <div className="h-1.5 bg-[var(--surface3)] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[var(--accent)] rounded-full"
                      style={{ width: `${(b.count / maxCount) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Quick links */}
        <div className="flex flex-col gap-3">
          {[
            { href: `/organiser/exhibitions/${id}/brands`, label: 'Manage Brands', sub: 'Import, invite and track brands', icon: Users },
            { href: `/organiser/exhibitions/${id}/passes`, label: 'Visitor Passes', sub: 'Allocate and track passes', icon: ScanLine },
            { href: `/organiser/exhibitions/${id}/report`, label: 'Post-Show Report', sub: 'Engagement & lead analytics', icon: BarChart2 },
          ].map(item => (
            <Link key={item.href} href={item.href}>
              <Card className="hover:border-[var(--accent)] transition-colors cursor-pointer flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[var(--surface2)] flex items-center justify-center flex-shrink-0">
                    <item.icon size={14} className="text-[var(--text3)]" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-[var(--text)]">{item.label}</div>
                    <div className="text-xs text-[var(--text3)]">{item.sub}</div>
                  </div>
                </div>
                <ChevronRight size={14} className="text-[var(--text3)] flex-shrink-0" />
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {ex.description && (
        <Card className="mt-6">
          <h3 className="text-xs font-bold text-[var(--text3)] uppercase tracking-wider mb-2">About</h3>
          <p className="text-sm text-[var(--text2)]">{ex.description}</p>
        </Card>
      )}
    </div>
  )
}
