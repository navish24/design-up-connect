import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Card } from '@/components/ui/Card'
import { Ticket, Users, ScanLine, TrendingUp } from 'lucide-react'

interface Props { params: Promise<{ id: string }> }

export default async function PassesPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const { data: ex } = await supabase.from('exhibitions').select('id, name').eq('id', id).single()
  if (!ex) notFound()

  // Passes allocated per brand
  const { data: brandPasses } = await supabase
    .from('exhibition_brands')
    .select(`
      brand_id,
      passes_allocated,
      brands(name),
      visitor_passes:visitor_passes(count),
      activated_passes:visitor_passes(count)
    `)
    .eq('exhibition_id', id)

  // Overall totals
  const { count: totalAllocated } = await supabase
    .from('visitor_passes')
    .select('*', { count: 'exact', head: true })
    .eq('exhibition_id', id)

  const { count: totalScanned } = await supabase
    .from('visitor_passes')
    .select('*', { count: 'exact', head: true })
    .eq('exhibition_id', id)
    .eq('scanned', true)

  const conversionRate = totalAllocated ? Math.round(((totalScanned ?? 0) / totalAllocated) * 100) : 0

  const summaryStats = [
    { label: 'Total Passes', value: totalAllocated ?? 0, icon: Ticket },
    { label: 'Scanned In', value: totalScanned ?? 0, icon: ScanLine },
    { label: 'Conversion', value: `${conversionRate}%`, icon: TrendingUp },
  ]

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-6">
        <Link href={`/organiser/exhibitions/${id}`} className="text-xs text-[var(--text3)] hover:text-[var(--accent)] transition-colors mb-3 inline-block">
          ← {ex.name}
        </Link>
        <h1 className="text-xl font-bold text-[var(--text)]">Visitor Passes</h1>
        <p className="text-sm text-[var(--text3)] mt-0.5">Pass allocation and conversion per brand</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {summaryStats.map(s => (
          <Card key={s.label} className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--text3)] font-medium uppercase tracking-wider">{s.label}</span>
              <s.icon size={14} className="text-[var(--text3)]" />
            </div>
            <div className="text-3xl font-bold text-[var(--text)] tabular-nums">{s.value}</div>
          </Card>
        ))}
      </div>

      {/* Funnel */}
      <Card className="mb-6">
        <h3 className="text-sm font-bold text-[var(--text)] mb-4">Conversion Funnel</h3>
        <div className="flex items-end gap-3 h-24">
          {[
            { label: 'Allocated', value: totalAllocated ?? 0, color: 'var(--accent)' },
            { label: 'Scanned', value: totalScanned ?? 0, color: 'var(--green)' },
          ].map(bar => {
            const pct = (totalAllocated ?? 0) > 0 ? (bar.value / (totalAllocated ?? 1)) * 100 : 0
            return (
              <div key={bar.label} className="flex flex-col items-center gap-2 flex-1">
                <span className="text-sm font-bold text-[var(--text)] tabular-nums">{bar.value.toLocaleString()}</span>
                <div className="w-full bg-[var(--surface3)] rounded-t-lg" style={{ height: '64px' }}>
                  <div
                    className="w-full rounded-t-lg transition-all"
                    style={{ height: `${pct}%`, background: bar.color, marginTop: `${100 - pct}%` }}
                  />
                </div>
                <span className="text-xs text-[var(--text3)]">{bar.label}</span>
              </div>
            )
          })}
        </div>
      </Card>

      {/* Per-brand breakdown */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--border)]">
          <h3 className="text-sm font-bold text-[var(--text)]">By Brand</h3>
        </div>
        {!brandPasses || brandPasses.length === 0 ? (
          <div className="text-center py-10 text-sm text-[var(--text3)]">
            <Users size={28} className="mx-auto mb-2 text-[var(--text3)]" />
            No brands have been added yet
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border)]">
                {['Brand', 'Allocated', 'Scanned', 'Conversion'].map(h => (
                  <th key={h} className="text-left text-xs font-bold uppercase tracking-wider text-[var(--text3)] px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {brandPasses.map(bp => {
                const allocated = (bp.visitor_passes as unknown as { count: number }[])?.[0]?.count ?? 0
                const scanned = (bp.activated_passes as unknown as { count: number }[])?.[0]?.count ?? 0
                const rate = allocated > 0 ? Math.round((scanned / allocated) * 100) : 0
                return (
                  <tr key={bp.brand_id} className="hover:bg-[var(--surface2)] transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-[var(--text)]">
                      {(bp.brands as unknown as { name: string } | null)?.name ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-[var(--text2)] tabular-nums">{allocated}</td>
                    <td className="px-4 py-3 text-sm text-[var(--text2)] tabular-nums">{scanned}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-[var(--surface3)] rounded-full h-1.5 max-w-20">
                          <div
                            className="h-full bg-[var(--green)] rounded-full"
                            style={{ width: `${rate}%` }}
                          />
                        </div>
                        <span className="text-xs text-[var(--text3)] tabular-nums w-8">{rate}%</span>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
