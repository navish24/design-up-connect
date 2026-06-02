'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Users } from 'lucide-react'

interface Rep {
  id: string
  user_id: string
  role: string
  status: string
  users: { full_name: string | null; email: string | null; phone: string | null } | null
  scan_count: number
}

export default function ExhibitionRepresentativesPage() {
  const { id: exhibitionBrandId } = useParams<{ id: string }>()
  const supabase = createClient()

  const [reps, setReps] = useState<Rep[]>([])
  const [brandId, setBrandId] = useState('')
  const [exhibitionId, setExhibitionId] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      // Get exhibition_brand to find brand_id and exhibition_id
      const { data: eb } = await supabase
        .from('exhibition_brands')
        .select('brand_id, exhibition_id')
        .eq('id', exhibitionBrandId)
        .single()

      if (!eb) { setLoading(false); return }
      setBrandId(eb.brand_id)
      setExhibitionId(eb.exhibition_id)

      // Get all approved brand members with user info
      const { data: members } = await supabase
        .from('brand_members')
        .select('id, user_id, role, status, users(full_name, email, phone)')
        .eq('brand_id', eb.brand_id)
        .eq('status', 'approved')
        .order('role')

      if (!members) { setLoading(false); return }

      // Get scan counts per rep for this exhibition + brand
      const { data: scans } = await supabase
        .from('visitor_scans')
        .select('rep_id')
        .eq('exhibition_id', eb.exhibition_id)
        .eq('brand_id', eb.brand_id)
        .not('rep_id', 'is', null)

      const scansByRep: Record<string, number> = {}
      scans?.forEach(s => {
        if (s.rep_id) scansByRep[s.rep_id] = (scansByRep[s.rep_id] ?? 0) + 1
      })

      setReps(members.map(m => ({
        ...m,
        users: m.users as unknown as Rep['users'],
        scan_count: scansByRep[m.user_id] ?? 0,
      })))
      setLoading(false)
    }
    load()
  }, [exhibitionBrandId])

  function nameOf(r: Rep) {
    return r.users?.full_name ?? r.users?.email ?? r.users?.phone ?? 'Unknown'
  }

  const admins = reps.filter(r => r.role === 'admin')
  const repList = reps.filter(r => r.role === 'rep')
  const totalScans = reps.reduce((sum, r) => sum + r.scan_count, 0)

  if (loading) return <div className="p-8 text-sm text-[var(--text3)]">Loading…</div>

  if (reps.length === 0) {
    return (
      <div className="p-8 max-w-5xl mx-auto text-center py-16">
        <Users size={32} className="text-[var(--text3)] mx-auto mb-3" />
        <p className="text-sm text-[var(--text3)]">No approved team members yet.</p>
        <p className="text-xs text-[var(--text3)] mt-1">Approve team members from the People page.</p>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: 'Total Reps', value: reps.length },
          { label: 'Total Scans by Team', value: totalScans },
          { label: 'Avg Scans / Rep', value: reps.length > 0 ? Math.round(totalScans / reps.length) : 0 },
        ].map(({ label, value }) => (
          <Card key={label}>
            <div className="text-2xl font-bold text-[var(--text)]">{value}</div>
            <div className="text-xs text-[var(--text3)] mt-0.5">{label}</div>
          </Card>
        ))}
      </div>

      {/* Admins */}
      {admins.length > 0 && (
        <section className="mb-8">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text3)] mb-3">
            Brand Admins
          </h2>
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  {['Name', 'Contact', 'Scans at this Exhibition'].map(h => (
                    <th key={h} className="text-left text-xs font-bold uppercase tracking-wider text-[var(--text3)] px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {admins.map(r => (
                  <RepRow key={r.id} rep={r} nameOf={nameOf} />
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Reps */}
      {repList.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text3)]">
              Representatives ({repList.length})
            </h2>
            {totalScans > 0 && (
              <span className="text-xs text-[var(--text3)]">Sorted by scan count</span>
            )}
          </div>
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  {['Name', 'Contact', 'Scans at this Exhibition'].map(h => (
                    <th key={h} className="text-left text-xs font-bold uppercase tracking-wider text-[var(--text3)] px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {repList
                  .sort((a, b) => b.scan_count - a.scan_count)
                  .map(r => <RepRow key={r.id} rep={r} nameOf={nameOf} />)}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}

function RepRow({ rep: r, nameOf }: { rep: Rep; nameOf: (r: Rep) => string }) {
  return (
    <tr className="hover:bg-[var(--surface2)] transition-colors">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[var(--surface2)] border border-[var(--border)] flex items-center justify-center text-xs font-bold text-[var(--text2)] flex-shrink-0">
            {nameOf(r).charAt(0).toUpperCase()}
          </div>
          <span className="text-sm font-medium text-[var(--text)]">{nameOf(r)}</span>
        </div>
      </td>
      <td className="px-4 py-3 text-xs text-[var(--text3)]">
        {r.users?.email ?? r.users?.phone ?? '—'}
      </td>
      <td className="px-4 py-3">
        {r.scan_count > 0 ? (
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-[var(--text)]">{r.scan_count}</span>
            <div className="flex-1 max-w-24 h-1.5 bg-[var(--surface2)] rounded-full overflow-hidden">
              <div
                className="h-full bg-[var(--accent)] rounded-full"
                style={{ width: `${Math.min(100, r.scan_count * 10)}%` }}
              />
            </div>
          </div>
        ) : (
          <span className="text-xs text-[var(--text3)]">No scans yet</span>
        )}
      </td>
    </tr>
  )
}
