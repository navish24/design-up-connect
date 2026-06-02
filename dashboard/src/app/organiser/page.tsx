import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Calendar, Users, ScanLine, Plus } from 'lucide-react'
import { Button } from '@/components/ui/Button'

export default async function OrganiserDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: exhibitions } = await supabase
    .from('exhibitions')
    .select('*, exhibition_brands(count)')
    .eq('organiser_id', user!.id)
    .order('start_date', { ascending: false })
    .limit(5)

  const now = new Date().toISOString().split('T')[0]

  const activeExhibitions = (exhibitions ?? []).filter(ex => ex.start_date <= now && ex.end_date >= now)
  const upcomingExhibitions = (exhibitions ?? []).filter(ex => ex.start_date > now)

  // Stats across all exhibitions
  const { count: totalBrands } = await supabase
    .from('exhibition_brands')
    .select('*', { count: 'exact', head: true })
    .in('exhibition_id', (exhibitions ?? []).map(e => e.id))

  const { count: totalEntries } = await supabase
    .from('gate_entries')
    .select('*', { count: 'exact', head: true })
    .in('exhibition_id', (exhibitions ?? []).map(e => e.id))

  function getState(ex: { start_date: string; end_date: string }) {
    if (ex.start_date > now) return { label: 'Upcoming', variant: 'accent' as const }
    if (ex.end_date >= now) return { label: 'Active', variant: 'green' as const }
    return { label: 'Ended', variant: 'neutral' as const }
  }

  const { data: profile } = await supabase.from('users').select('name').eq('id', user!.id).single()

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text)]">
            {profile?.name ? `Hello, ${profile.name.split(' ')[0]}` : 'Dashboard'}
          </h1>
          <p className="text-sm text-[var(--text3)] mt-1">
            {activeExhibitions.length > 0
              ? `${activeExhibitions.length} exhibition${activeExhibitions.length > 1 ? 's' : ''} live right now`
              : upcomingExhibitions.length > 0
              ? `${upcomingExhibitions.length} upcoming exhibition${upcomingExhibitions.length > 1 ? 's' : ''}`
              : 'No active exhibitions'}
          </p>
        </div>
        <Link href="/organiser/exhibitions/new">
          <Button><Plus size={15} /> Create Exhibition</Button>
        </Link>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: 'Total Exhibitions', value: (exhibitions ?? []).length, icon: Calendar },
          { label: 'Total Brands', value: totalBrands ?? 0, icon: Users },
          { label: 'Gate Entries', value: totalEntries ?? 0, icon: ScanLine },
        ].map(s => (
          <Card key={s.label} className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--text3)] font-medium uppercase tracking-wider">{s.label}</span>
              <s.icon size={14} className="text-[var(--text3)]" />
            </div>
            <div className="text-3xl font-bold text-[var(--text)] tabular-nums">{s.value.toLocaleString()}</div>
          </Card>
        ))}
      </div>

      {/* Recent exhibitions */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-bold text-[var(--text)]">Recent Exhibitions</h2>
        <Link href="/organiser/exhibitions" className="text-xs text-[var(--accent)] hover:opacity-80">View all →</Link>
      </div>

      {(exhibitions ?? []).length === 0 ? (
        <Card className="text-center py-12">
          <Calendar size={32} className="mx-auto mb-3 text-[var(--text3)]" />
          <p className="text-sm text-[var(--text2)] mb-4">No exhibitions yet</p>
          <Link href="/organiser/exhibitions/new">
            <Button size="sm"><Plus size={13} /> Create your first exhibition</Button>
          </Link>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {(exhibitions ?? []).map(ex => {
            const { label, variant } = getState(ex)
            const brandCount = (ex.exhibition_brands as { count: number }[])?.[0]?.count ?? 0
            return (
              <Link key={ex.id} href={`/organiser/exhibitions/${ex.id}`}>
                <Card className="hover:border-[var(--accent)] transition-colors cursor-pointer">
                  <div className="flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-0.5">
                        <span className="font-semibold text-sm text-[var(--text)]">{ex.name}</span>
                        <Badge label={label} variant={variant} />
                      </div>
                      <div className="text-xs text-[var(--text3)]">
                        {new Date(ex.start_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        {' · '}{ex.venue}, {ex.city}
                        {' · '}{brandCount} brand{brandCount !== 1 ? 's' : ''}
                      </div>
                    </div>
                    <span className="text-[var(--text3)] text-sm">→</span>
                  </div>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
