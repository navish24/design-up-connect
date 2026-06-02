'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { LeadRatingBadge, Badge } from '@/components/ui/Badge'
import { Search, Filter, Download, Plus, ChevronDown, ChevronUp, X } from 'lucide-react'
import type { Visitor, LeadRating } from '@/lib/types'

const RATING_OPTIONS: { label: string; value: LeadRating | 'all' }[] = [
  { label: 'All Ratings', value: 'all' },
  { label: 'Hot', value: 'hot' },
  { label: 'Warm', value: 'warm' },
  { label: 'Cold', value: 'cold' },
  { label: 'Unrated', value: null },
]

const SCAN_TYPE_OPTIONS = [
  { label: 'All Types', value: 'all' },
  { label: 'Visitor-Initiated', value: 'visitor_initiated' },
  { label: 'Rep-Initiated', value: 'rep_initiated' },
  { label: 'Manual', value: 'manual' },
]

const SORT_OPTIONS = [
  { label: 'Most Recent', value: 'recent' },
  { label: 'Lead Rating', value: 'rating' },
  { label: 'Name A–Z', value: 'name' },
]

interface ManualEntryForm {
  full_name: string; profession: string; company: string
  email: string; phone: string; notes: string
}

export default function VisitorListPage() {
  const { id: exhibitionId } = useParams<{ id: string }>()
  const supabase = createClient()

  const [visitors, setVisitors] = useState<Visitor[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterRating, setFilterRating] = useState<LeadRating | 'all'>('all')
  const [filterScanType, setFilterScanType] = useState('all')
  const [sort, setSort] = useState('recent')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showManual, setShowManual] = useState(false)
  const [manualForm, setManualForm] = useState<ManualEntryForm>({
    full_name: '', profession: '', company: '', email: '', phone: '', notes: '',
  })
  const [savingManual, setSavingManual] = useState(false)
  const [brandId, setBrandId] = useState<string>('')
  const [repNames, setRepNames] = useState<Record<string, string>>({})

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user
      const { data: brand } = await supabase.from('brands').select('id').eq('admin_user_id', user!.id).single()
      if (!brand) return
      setBrandId(brand.id)

      const { data } = await supabase
        .from('visitors')
        .select('*')
        .eq('exhibition_id', exhibitionId)
        .eq('brand_id', brand.id)
      setVisitors((data as Visitor[]) ?? [])

      // Load rep names
      const repIds = [...new Set((data ?? []).map((v: Visitor) => v.rep_id).filter(Boolean))]
      if (repIds.length > 0) {
        const { data: reps } = await supabase.from('users').select('id, full_name').in('id', repIds)
        const names: Record<string, string> = {}
        reps?.forEach(r => { names[r.id] = r.full_name })
        setRepNames(names)
      }
      setLoading(false)
    }
    load()
  }, [exhibitionId])

  const filtered = visitors.filter(v => {
    if (search) {
      const q = search.toLowerCase()
      if (!v.full_name?.toLowerCase().includes(q) && !v.company?.toLowerCase().includes(q) && !v.profession?.toLowerCase().includes(q)) return false
    }
    if (filterRating !== 'all') {
      if (filterRating === null && v.lead_rating !== null) return false
      if (filterRating !== null && v.lead_rating !== filterRating) return false
    }
    if (filterScanType !== 'all' && v.scan_type !== filterScanType) return false
    return true
  }).sort((a, b) => {
    if (sort === 'name') return (a.full_name ?? '').localeCompare(b.full_name ?? '')
    if (sort === 'rating') {
      const order = { hot: 0, warm: 1, cold: 2, null: 3 }
      return (order[a.lead_rating as keyof typeof order] ?? 3) - (order[b.lead_rating as keyof typeof order] ?? 3)
    }
    return new Date(b.visitor_timestamp).getTime() - new Date(a.visitor_timestamp).getTime()
  })

  async function updateRating(visitorId: string, rating: LeadRating) {
    await supabase.from('visitors').update({ lead_rating: rating }).eq('id', visitorId)
    setVisitors(prev => prev.map(v => v.id === visitorId ? { ...v, lead_rating: rating } : v))
  }

  async function updateNotes(visitorId: string, notes: string) {
    await supabase.from('visitors').update({ notes }).eq('id', visitorId)
    setVisitors(prev => prev.map(v => v.id === visitorId ? { ...v, notes } : v))
  }

  async function saveManualEntry() {
    if (!manualForm.full_name) return
    setSavingManual(true)
    const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user
    const { data } = await supabase.from('visitors').insert({
      exhibition_id: exhibitionId,
      brand_id: brandId,
      scan_type: 'manual',
      first_name: manualForm.full_name.split(' ')[0],
      full_name: manualForm.full_name,
      profession: manualForm.profession,
      company: manualForm.company,
      email: manualForm.email,
      phone: manualForm.phone,
      notes: manualForm.notes,
      visitor_timestamp: new Date().toISOString(),
      rep_id: user!.id,
      is_manual: true,
    }).select().single()
    if (data) setVisitors(prev => [data as Visitor, ...prev])
    setShowManual(false)
    setManualForm({ full_name: '', profession: '', company: '', email: '', phone: '', notes: '' })
    setSavingManual(false)
  }

  async function exportCSV() {
    const rows = filtered.map(v => [
      v.full_name, v.profession, v.company, v.email, v.phone,
      new Date(v.visitor_timestamp).toLocaleString(),
      v.scan_type, v.rep_id ? repNames[v.rep_id] : '',
      v.lead_rating ?? '', v.notes ?? '',
      v.is_manual ? 'Manual' : '',
    ].map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))
    const header = 'Name,Profession,Company,Email,Phone,Timestamp,Scan Type,Rep,Rating,Notes,Manual'
    const csv = [header, ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = `visitors-${exhibitionId}.csv`; a.click()
  }

  const visitorInitiated = filtered.filter(v => v.scan_type === 'visitor_initiated')
  const repInitiated = filtered.filter(v => v.scan_type !== 'visitor_initiated')

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-[var(--text)]">Visitor List</h1>
          <p className="text-sm text-[var(--text3)] mt-0.5">{visitors.length} total contacts</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => setShowManual(true)}>
            <Plus size={14} /> Add Manual Lead
          </Button>
          <Button variant="secondary" size="sm" onClick={exportCSV}>
            <Download size={14} /> Export CSV
          </Button>
        </div>
      </div>

      {/* Search + Filters */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text3)]" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search name, company, profession..."
            style={{ paddingLeft: '32px' }}
          />
        </div>
        <select value={filterRating as string} onChange={e => setFilterRating(e.target.value === 'null' ? null : e.target.value as LeadRating | 'all')} style={{ width: 'auto' }}>
          {RATING_OPTIONS.map(o => <option key={String(o.value)} value={String(o.value)}>{o.label}</option>)}
        </select>
        <select value={filterScanType} onChange={e => setFilterScanType(e.target.value)} style={{ width: 'auto' }}>
          {SCAN_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select value={sort} onChange={e => setSort(e.target.value)} style={{ width: 'auto' }}>
          {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        {(search || filterRating !== 'all' || filterScanType !== 'all') && (
          <button
            onClick={() => { setSearch(''); setFilterRating('all'); setFilterScanType('all') }}
            className="flex items-center gap-1 text-xs text-[var(--text3)] hover:text-[var(--text2)] px-3 py-2 border border-[var(--border)] rounded-xl"
          >
            <X size={12} /> Clear
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-[var(--text3)] text-center py-12">Loading visitors...</p>
      ) : (
        <div className="flex flex-col gap-6">
          {/* Rep-Initiated — high intent */}
          {repInitiated.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <h2 className="text-sm font-bold text-[var(--text)]">Scanned by Team</h2>
                <Badge label={String(repInitiated.length)} variant="accent" />
                <span className="text-xs text-[var(--text3)]">· High intent</span>
              </div>
              <div className="flex flex-col gap-2">
                {repInitiated.map(v => (
                  <VisitorRow
                    key={v.id} visitor={v} repNames={repNames}
                    expanded={expandedId === v.id}
                    onToggle={() => setExpandedId(expandedId === v.id ? null : v.id)}
                    onRating={updateRating} onNotes={updateNotes}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Visitor-Initiated — low intent */}
          {visitorInitiated.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <h2 className="text-sm font-bold text-[var(--text)]">Scanned by Visitor</h2>
                <Badge label={String(visitorInitiated.length)} variant="neutral" />
                <span className="text-xs text-[var(--text3)]">· Saved your brand</span>
              </div>
              <div className="flex flex-col gap-2">
                {visitorInitiated.map(v => (
                  <VisitorRow
                    key={v.id} visitor={v} repNames={repNames}
                    expanded={expandedId === v.id}
                    onToggle={() => setExpandedId(expandedId === v.id ? null : v.id)}
                    onRating={updateRating} onNotes={updateNotes}
                  />
                ))}
              </div>
            </div>
          )}

          {filtered.length === 0 && (
            <div className="text-center py-12 text-sm text-[var(--text3)]">
              {visitors.length === 0 ? 'No visitors yet for this exhibition.' : 'No visitors match your filters.'}
            </div>
          )}
        </div>
      )}

      {/* Manual lead entry modal */}
      {showManual && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 w-full max-w-md flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-[var(--text)]">Add Manual Lead</h2>
              <button onClick={() => setShowManual(false)} className="text-[var(--text3)]"><X size={18} /></button>
            </div>
            <div className="flex flex-col gap-3">
              {[
                { field: 'full_name', label: 'Full Name', placeholder: 'e.g. Priya Mehta' },
                { field: 'profession', label: 'Profession', placeholder: 'e.g. Interior Designer' },
                { field: 'company', label: 'Company', placeholder: 'e.g. Studio Ninety' },
                { field: 'email', label: 'Email', placeholder: 'priya@studio.com' },
                { field: 'phone', label: 'Phone', placeholder: '+91 ...' },
              ].map(f => (
                <div key={f.field} className="flex flex-col gap-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-[var(--text3)]">{f.label}</label>
                  <input
                    value={manualForm[f.field as keyof ManualEntryForm]}
                    onChange={e => setManualForm(m => ({ ...m, [f.field]: e.target.value }))}
                    placeholder={f.placeholder}
                  />
                </div>
              ))}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold uppercase tracking-wider text-[var(--text3)]">Notes</label>
                <textarea
                  rows={2}
                  value={manualForm.notes}
                  onChange={e => setManualForm(m => ({ ...m, notes: e.target.value }))}
                  placeholder="Any notes about this lead..."
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="secondary" size="sm" onClick={() => setShowManual(false)}>Cancel</Button>
              <Button size="sm" loading={savingManual} onClick={saveManualEntry} disabled={!manualForm.full_name}>
                Save Lead
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function VisitorRow({
  visitor: v, repNames, expanded, onToggle, onRating, onNotes,
}: {
  visitor: Visitor
  repNames: Record<string, string>
  expanded: boolean
  onToggle: () => void
  onRating: (id: string, r: LeadRating) => void
  onNotes: (id: string, n: string) => void
}) {
  const [notes, setNotes] = useState(v.notes ?? '')
  const [savingNotes, setSavingNotes] = useState(false)

  const ts = new Date(v.visitor_timestamp).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl overflow-hidden">
      <div
        className="flex items-center gap-4 p-4 cursor-pointer hover:bg-[var(--surface2)] transition-colors"
        onClick={onToggle}
      >
        {/* Avatar */}
        <div className="w-9 h-9 rounded-full bg-[var(--surface2)] border border-[var(--border)] flex items-center justify-center text-xs font-bold text-[var(--text2)] flex-shrink-0">
          {(v.full_name ?? v.first_name)?.charAt(0)?.toUpperCase() ?? '?'}
        </div>
        {/* Name + meta */}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-[var(--text)] truncate">
            {v.full_name ?? v.first_name}
            {v.is_manual && (
              <span className="ml-2 text-xs bg-[var(--surface3)] text-[var(--text3)] px-1.5 py-0.5 rounded">Manual</span>
            )}
          </div>
          <div className="text-xs text-[var(--text3)] mt-0.5 truncate">
            {[v.profession, v.company].filter(Boolean).join(' · ')} · {ts}
          </div>
        </div>
        {/* Rating */}
        <div onClick={e => e.stopPropagation()} className="flex gap-1">
          {(['hot', 'warm', 'cold'] as LeadRating[]).map(r => (
            <button
              key={r as string}
              onClick={() => onRating(v.id, v.lead_rating === r ? null : r)}
              className={[
                'px-2 py-0.5 rounded-md text-xs font-semibold border transition-all',
                v.lead_rating === r
                  ? r === 'hot' ? 'bg-[var(--red-dim)] text-[var(--red)] border-[var(--red)]'
                    : r === 'warm' ? 'bg-orange-950/30 text-[var(--amber)] border-[var(--amber)]'
                    : 'bg-[var(--accent-dim)] text-[var(--accent)] border-[var(--accent)]'
                  : 'bg-transparent text-[var(--text3)] border-[var(--border)] hover:border-[var(--text3)]',
              ].join(' ')}
            >
              {(r as string).charAt(0).toUpperCase() + (r as string).slice(1)}
            </button>
          ))}
        </div>
        {expanded ? <ChevronUp size={14} className="text-[var(--text3)] flex-shrink-0" /> : <ChevronDown size={14} className="text-[var(--text3)] flex-shrink-0" />}
      </div>

      {expanded && (
        <div className="border-t border-[var(--border)] p-4 bg-[var(--surface2)] flex flex-col gap-4">
          {/* Full details */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            {[
              ['Email', v.email], ['Phone', v.phone],
              ['Rep', v.rep_id ? repNames[v.rep_id] : null],
              ['Scan type', v.scan_type?.replace('_', ' ')],
            ].map(([label, val]) => val ? (
              <div key={label as string}>
                <div className="text-xs text-[var(--text3)] font-semibold uppercase tracking-wider mb-0.5">{label}</div>
                <div className="text-[var(--text)]">{val}</div>
              </div>
            ) : null)}
          </div>
          {/* Notes */}
          <div>
            <div className="text-xs text-[var(--text3)] font-semibold uppercase tracking-wider mb-1.5">Notes</div>
            <textarea
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Add a note about this lead..."
              className="text-sm"
            />
            {notes !== (v.notes ?? '') && (
              <button
                onClick={async () => { setSavingNotes(true); await onNotes(v.id, notes); setSavingNotes(false) }}
                disabled={savingNotes}
                className="mt-1.5 text-xs text-[var(--accent)] font-semibold hover:underline disabled:opacity-50"
              >
                {savingNotes ? 'Saving...' : 'Save note'}
              </button>
            )}
          </div>
          {/* Qualification answers */}
          {v.qualification_answers && Object.keys(v.qualification_answers).length > 0 && (
            <div>
              <div className="text-xs text-[var(--text3)] font-semibold uppercase tracking-wider mb-2">Qualification</div>
              <div className="flex flex-col gap-1.5">
                {Object.entries(v.qualification_answers).map(([q, a]) => (
                  <div key={q} className="text-xs">
                    <span className="text-[var(--text3)]">{q}: </span>
                    <span className="text-[var(--text2)]">{a}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
