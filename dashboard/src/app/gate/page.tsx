import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Calendar, MapPin, ScanLine } from 'lucide-react'

export default async function GatePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: assignments } = await supabase
    .from('gate_staff_assignments')
    .select('exhibition_id, exhibitions(id, name, venue, city, start_date, end_date)')
    .eq('user_id', user!.id)
    .order('exhibitions(start_date)', { ascending: false })

  const now = new Date().toISOString().split('T')[0]
  type ExhibitionRow = { id: string; name: string; venue: string; city: string; start_date: string; end_date: string }
  const exhibitions = (assignments ?? []).map(a => a.exhibitions).filter(Boolean) as unknown as ExhibitionRow[]

  return (
    <div className="flex-1 flex flex-col p-6 max-w-lg mx-auto w-full">
      <div className="mb-8 pt-4">
        <div className="text-sm font-bold text-[var(--accent)] tracking-widest mb-1">DESIGNUP</div>
        <h1 className="text-xl font-bold text-white">Gate Staff</h1>
        <p className="text-sm text-gray-400 mt-0.5">Select an exhibition to begin scanning</p>
      </div>

      {exhibitions.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-3">
          <ScanLine size={40} className="text-gray-600" />
          <p className="text-gray-400 text-sm">No exhibitions assigned to you.</p>
          <p className="text-gray-600 text-xs">Contact your organiser to get access.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {exhibitions.map(ex => {
            const isActive = ex.start_date <= now && ex.end_date >= now
            return (
              <Link key={ex.id} href={`/gate/${ex.id}`}>
                <div className={[
                  'p-5 rounded-2xl border flex flex-col gap-2 active:scale-98 transition-transform',
                  isActive
                    ? 'bg-[var(--accent-dim)] border-[var(--accent)]'
                    : 'bg-[var(--surface)] border-[var(--border)]',
                ].join(' ')}>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white">{ex.name}</span>
                    {isActive && (
                      <span className="text-xs font-bold text-[var(--accent)] bg-[var(--accent-dim)] px-2 py-0.5 rounded-full">LIVE</span>
                    )}
                  </div>
                  <div className="flex flex-col gap-1 text-xs text-gray-400">
                    <span className="flex items-center gap-1.5">
                      <MapPin size={11} /> {ex.venue}, {ex.city}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Calendar size={11} />
                      {new Date(ex.start_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      {' – '}
                      {new Date(ex.end_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
