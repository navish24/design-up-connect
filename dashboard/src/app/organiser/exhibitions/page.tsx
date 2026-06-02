import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Plus, Calendar, MapPin } from 'lucide-react'

export default async function OrganiserExhibitionsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: exhibitions } = await supabase
    .from('exhibitions')
    .select('*, exhibition_brands(count)')
    .eq('organiser_id', user!.id)
    .order('start_date', { ascending: false })

  const now = new Date().toISOString().split('T')[0]

  function getState(ex: { start_date: string; end_date: string }) {
    if (ex.start_date > now) return { label: 'Upcoming', variant: 'accent' as const }
    if (ex.end_date >= now) return { label: 'Active', variant: 'green' as const }
    return { label: 'Ended', variant: 'neutral' as const }
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text)]">Exhibitions</h1>
          <p className="text-sm text-[var(--text3)] mt-1">{exhibitions?.length ?? 0} total</p>
        </div>
        <Link href="/organiser/exhibitions/new">
          <Button><Plus size={15} /> Create Exhibition</Button>
        </Link>
      </div>

      {exhibitions?.length === 0 && (
        <Card className="text-center py-16">
          <Calendar size={36} className="text-[var(--text3)] mx-auto mb-3" />
          <p className="text-sm text-[var(--text2)]">No exhibitions yet</p>
          <div className="mt-4">
            <Link href="/organiser/exhibitions/new">
              <Button size="sm"><Plus size={13} /> Create your first exhibition</Button>
            </Link>
          </div>
        </Card>
      )}

      <div className="flex flex-col gap-4">
        {exhibitions?.map(ex => {
          const { label, variant } = getState(ex)
          const brandCount = (ex.exhibition_brands as { count: number }[])?.[0]?.count ?? 0
          return (
            <Link key={ex.id} href={`/organiser/exhibitions/${ex.id}`}>
              <Card className="hover:border-[var(--accent)] transition-colors cursor-pointer">
                <div className="flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <h2 className="text-base font-bold text-[var(--text)]">{ex.name}</h2>
                      <Badge label={label} variant={variant} />
                    </div>
                    <div className="flex items-center gap-4 text-xs text-[var(--text3)]">
                      <span className="flex items-center gap-1">
                        <Calendar size={11} />
                        {new Date(ex.start_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        {' – '}
                        {new Date(ex.end_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin size={11} /> {ex.venue}, {ex.city}
                      </span>
                      <span>{brandCount} brand{brandCount !== 1 ? 's' : ''}</span>
                    </div>
                  </div>
                  <span className="text-[var(--text3)] mt-1">→</span>
                </div>
              </Card>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
