import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Card } from '@/components/ui/Card'
import { BarChart2, Users, ScanLine, Star, TrendingUp, Download } from 'lucide-react'

interface Props { params: Promise<{ id: string }> }

export default async function ReportPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const { data: ex } = await supabase.from('exhibitions').select('id, name, start_date, end_date').eq('id', id).single()
  if (!ex) notFound()

  // Aggregate stats
  const [
    { count: totalEntries },
    { count: totalScans },
    { count: hotLeads },
    { count: warmLeads },
  ] = await Promise.all([
    supabase.from('gate_entries').select('*', { count: 'exact', head: true }).eq('exhibition_id', id),
    supabase.from('visitor_scans').select('*', { count: 'exact', head: true }).eq('exhibition_id', id),
    supabase.from('visitor_scans').select('*', { count: 'exact', head: true }).eq('exhibition_id', id).eq('lead_rating', 'hot'),
    supabase.from('visitor_scans').select('*', { count: 'exact', head: true }).eq('exhibition_id', id).eq('lead_rating', 'warm'),
  ])

  // Top brands by engagement
  const { data: scanData } = await supabase
    .from('visitor_scans')
    .select('brand_id, lead_rating, brands(name)')
    .eq('exhibition_id', id)

  const brandMap: Record<string, { name: string; total: number; hot: number; warm: number }> = {}
  for (const s of scanData ?? []) {
    const bid = s.brand_id
    const name = (s.brands as unknown as { name: string } | null)?.name ?? bid
    if (!brandMap[bid]) brandMap[bid] = { name, total: 0, hot: 0, warm: 0 }
    brandMap[bid].total++
    if (s.lead_rating === 'hot') brandMap[bid].hot++
    if (s.lead_rating === 'warm') brandMap[bid].warm++
  }
  const rankedBrands = Object.values(brandMap).sort((a, b) => b.hot * 3 + b.warm - (a.hot * 3 + a.warm)).slice(0, 10)

  // Hourly distribution (gate entries)
  const { data: entries } = await supabase
    .from('gate_entries')
    .select('created_at')
    .eq('exhibition_id', id)

  const hourCounts: number[] = Array(24).fill(0)
  for (const e of entries ?? []) {
    const h = new Date(e.created_at).getHours()
    hourCounts[h]++
  }
  const peakHour = hourCounts.indexOf(Math.max(...hourCounts))
  const maxHourCount = Math.max(...hourCounts, 1)

  const summaryStats = [
    { label: 'Gate Entries', value: (totalEntries ?? 0).toLocaleString(), icon: Users, color: 'var(--accent)' },
    { label: 'Rep Scans', value: (totalScans ?? 0).toLocaleString(), icon: ScanLine, color: 'var(--green)' },
    { label: 'Hot Leads', value: (hotLeads ?? 0).toLocaleString(), icon: Star, color: 'var(--red)' },
    { label: 'Warm Leads', value: (warmLeads ?? 0).toLocaleString(), icon: TrendingUp, color: 'var(--amber)' },
  ]

  const exhibitionDays = Math.ceil(
    (new Date(ex.end_date).getTime() - new Date(ex.start_date).getTime()) / (1000 * 60 * 60 * 24)
  ) + 1

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-6">
        <Link href={`/organiser/exhibitions/${id}`} className="text-xs text-[var(--text3)] hover:text-[var(--accent)] transition-colors mb-3 inline-block">
          ← {ex.name}
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-[var(--text)]">Post-Show Report</h1>
            <p className="text-sm text-[var(--text3)] mt-0.5">
              {new Date(ex.start_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
              {' – '}
              {new Date(ex.end_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
              {' · '}{exhibitionDays} day{exhibitionDays !== 1 ? 's' : ''}
            </p>
          </div>
          <button className="flex items-center gap-2 text-xs text-[var(--text3)] hover:text-[var(--accent)] border border-[var(--border)] hover:border-[var(--accent)] rounded-xl px-3 py-2 transition-all">
            <Download size={13} /> Export CSV
          </button>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {summaryStats.map(s => (
          <Card key={s.label} className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--text3)] uppercase tracking-wider">{s.label}</span>
              <s.icon size={13} style={{ color: s.color }} />
            </div>
            <div className="text-2xl font-bold tabular-nums" style={{ color: s.color }}>{s.value}</div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-6 mb-6">
        {/* Hourly heatmap */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-[var(--text)]">Entry by Hour</h3>
            {maxHourCount > 0 && (
              <span className="text-xs text-[var(--text3)]">
                Peak: {peakHour}:00
              </span>
            )}
          </div>
          <div className="flex items-end gap-0.5 h-20">
            {hourCounts.map((count, h) => (
              <div key={h} className="flex-1 flex flex-col items-center">
                <div
                  className="w-full rounded-sm"
                  style={{
                    height: `${(count / maxHourCount) * 64}px`,
                    background: h === peakHour ? 'var(--accent)' : 'var(--surface3)',
                    minHeight: count > 0 ? '4px' : '0',
                  }}
                />
              </div>
            ))}
          </div>
          <div className="flex justify-between text-xs text-[var(--text3)] mt-1.5">
            <span>12am</span><span>6am</span><span>12pm</span><span>6pm</span><span>11pm</span>
          </div>
        </Card>

        {/* Lead quality breakdown */}
        <Card>
          <h3 className="text-sm font-bold text-[var(--text)] mb-4">Lead Quality</h3>
          {(totalScans ?? 0) === 0 ? (
            <div className="flex items-center justify-center h-20 text-sm text-[var(--text3)]">No scan data</div>
          ) : (
            <div className="flex flex-col gap-3">
              {[
                { label: 'Hot', count: hotLeads ?? 0, color: 'var(--red)' },
                { label: 'Warm', count: warmLeads ?? 0, color: 'var(--amber)' },
                { label: 'Cold', count: (totalScans ?? 0) - (hotLeads ?? 0) - (warmLeads ?? 0), color: 'var(--text3)' },
              ].map(tier => {
                const pct = totalScans ? Math.round((tier.count / totalScans) * 100) : 0
                return (
                  <div key={tier.label} className="flex items-center gap-3">
                    <span className="text-xs w-8 text-[var(--text3)]">{tier.label}</span>
                    <div className="flex-1 bg-[var(--surface3)] rounded-full h-2">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: tier.color }} />
                    </div>
                    <span className="text-xs tabular-nums text-[var(--text2)] w-10 text-right">{tier.count} ({pct}%)</span>
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      </div>

      {/* Brand leaderboard */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <BarChart2 size={15} className="text-[var(--text3)]" />
          <h3 className="text-sm font-bold text-[var(--text)]">Brand Engagement Ranking</h3>
        </div>
        {rankedBrands.length === 0 ? (
          <p className="text-sm text-[var(--text3)] text-center py-6">No engagement data available</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border)]">
                {['#', 'Brand', 'Total Scans', 'Hot', 'Warm'].map(h => (
                  <th key={h} className="text-left text-xs font-bold uppercase tracking-wider text-[var(--text3)] pb-3 pr-4">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {rankedBrands.map((b, i) => (
                <tr key={b.name} className="hover:bg-[var(--surface2)] transition-colors">
                  <td className="py-3 pr-4 text-sm text-[var(--text3)]">{i + 1}</td>
                  <td className="py-3 pr-4 text-sm font-medium text-[var(--text)]">{b.name}</td>
                  <td className="py-3 pr-4 text-sm tabular-nums text-[var(--text2)]">{b.total}</td>
                  <td className="py-3 pr-4">
                    <span className="text-xs font-bold text-[var(--red)]">{b.hot}</span>
                  </td>
                  <td className="py-3 pr-4">
                    <span className="text-xs font-bold text-[var(--amber)]">{b.warm}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}
