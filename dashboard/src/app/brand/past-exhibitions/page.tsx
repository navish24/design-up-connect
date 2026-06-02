'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { Plus, X, ImagePlus, Trash2, Pencil, MapPin, Calendar } from 'lucide-react'

interface ExhibitionImage { id: string; url: string; display_order: number }

interface PastExhibition {
  id: string
  brand_id: string
  name: string
  city: string | null
  venue: string | null
  start_date: string | null
  end_date: string | null
  description: string | null
  source: 'system' | 'manual'
  images: ExhibitionImage[]
}

interface Draft {
  name: string; city: string; venue: string; description: string
  start_date: string; end_date: string
  newImages: File[]; newPreviews: string[]
  existingImages: ExhibitionImage[]
}

async function uploadImage(file: File): Promise<string | null> {
  try {
    const res = await fetch('/api/upload-signed-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folder: 'exhibitions', resource_type: 'image' }),
    })
    const { signature, timestamp, apiKey, cloudName, folder } = await res.json()
    if (!cloudName || cloudName === 'your_cloudinary_cloud_name') return null
    const fd = new FormData()
    fd.append('file', file); fd.append('signature', signature)
    fd.append('timestamp', String(timestamp)); fd.append('api_key', apiKey); fd.append('folder', folder)
    const up = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: 'POST', body: fd })
    return (await up.json()).secure_url ?? null
  } catch { return null }
}

function formatDateRange(start: string | null, end: string | null) {
  if (!start && !end) return null
  const fmt = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  if (start && end) return `${fmt(start)} – ${fmt(end)}`
  if (start) return `From ${fmt(start)}`
  return `Until ${fmt(end!)}`
}

export default function PastExhibitionsPage() {
  const supabase = createClient()
  const [exhibitions, setExhibitions] = useState<PastExhibition[]>([])
  const [brandId, setBrandId] = useState('')
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
    if (!user) return

    const { data: brand } = await supabase.from('brands').select('id').eq('admin_user_id', user.id).maybeSingle()
    if (!brand) { setLoading(false); return }
    setBrandId(brand.id)

    const today = new Date().toISOString().split('T')[0]

    // System exhibitions: from exhibition_brands where exhibition ended
    const { data: ebRows } = await supabase
      .from('exhibition_brands')
      .select('id, exhibitions(id, name, city, venue, start_date, end_date, description)')
      .eq('brand_id', brand.id)

    const systemExhibitions: PastExhibition[] = (ebRows ?? [])
      .filter(row => {
        const ex = row.exhibitions as unknown as { end_date?: string } | null
        return ex?.end_date && ex.end_date < today
      })
      .map(row => {
        const ex = row.exhibitions as unknown as { id: string; name: string; city?: string; venue?: string; start_date?: string; end_date?: string; description?: string }
        return {
          id: `sys_${ex.id}`,
          brand_id: brand.id,
          name: ex.name,
          city: ex.city ?? null,
          venue: ex.venue ?? null,
          start_date: ex.start_date ?? null,
          end_date: ex.end_date ?? null,
          description: ex.description ?? null,
          source: 'system' as const,
          images: [],
        }
      })

    // Manual past exhibitions: from brand_past_exhibitions table
    const { data: manualRows } = await supabase
      .from('brand_past_exhibitions')
      .select('*, images:brand_past_exhibition_images(*)')
      .eq('brand_id', brand.id)
      .order('end_date', { ascending: false })

    const manualExhibitions: PastExhibition[] = (manualRows ?? []).map(row => ({
      id: row.id,
      brand_id: row.brand_id,
      name: row.name,
      city: row.city ?? null,
      venue: row.venue ?? null,
      start_date: row.start_date ?? null,
      end_date: row.end_date ?? null,
      description: row.description ?? null,
      source: 'manual' as const,
      images: row.images ?? [],
    }))

    // Merge: system first, then manual; sort by end_date desc
    const all = [...systemExhibitions, ...manualExhibitions].sort((a, b) => {
      const da = a.end_date ?? ''
      const db = b.end_date ?? ''
      return db.localeCompare(da)
    })

    setExhibitions(all)
    setLoading(false)
  }

  const emptyDraft = (): Draft => ({ name: '', city: '', venue: '', description: '', start_date: '', end_date: '', newImages: [], newPreviews: [], existingImages: [] })

  function startAdd() { setEditingId(null); setDraft(emptyDraft()); setError('') }

  function startEdit(ex: PastExhibition) {
    if (ex.source === 'system') return // system exhibitions aren't editable here
    setEditingId(ex.id)
    setDraft({
      name: ex.name, city: ex.city ?? '', venue: ex.venue ?? '',
      description: ex.description ?? '',
      start_date: ex.start_date ?? '', end_date: ex.end_date ?? '',
      newImages: [], newPreviews: [], existingImages: ex.images ?? []
    })
    setError('')
  }

  function addImages(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length || !draft) return
    setDraft(d => d ? { ...d, newImages: [...d.newImages, ...files], newPreviews: [...d.newPreviews, ...files.map(f => URL.createObjectURL(f))] } : d)
  }

  async function save() {
    if (!draft?.name) { setError('Exhibition name is required'); return }
    setSaving(true); setError('')
    try {
      const uploadedUrls = (await Promise.all(draft.newImages.map(uploadImage))).filter((u): u is string => u !== null)

      if (editingId) {
        await supabase.from('brand_past_exhibitions').update({
          name: draft.name, city: draft.city, venue: draft.venue,
          description: draft.description, start_date: draft.start_date || null, end_date: draft.end_date || null,
        }).eq('id', editingId)
        const existing = exhibitions.find(ex => ex.id === editingId)
        const removedIds = (existing?.images ?? []).filter(img => !draft.existingImages.find(e => e.id === img.id)).map(img => img.id)
        if (removedIds.length) await supabase.from('brand_past_exhibition_images').delete().in('id', removedIds)
        if (uploadedUrls.length) await supabase.from('brand_past_exhibition_images').insert(uploadedUrls.map((url, i) => ({ id: crypto.randomUUID(), past_exhibition_id: editingId, url, display_order: draft.existingImages.length + i })))
      } else {
        const id = crypto.randomUUID()
        const { error: ce } = await supabase.from('brand_past_exhibitions').insert({
          id, brand_id: brandId, name: draft.name, city: draft.city, venue: draft.venue,
          description: draft.description, start_date: draft.start_date || null, end_date: draft.end_date || null,
        })
        if (ce) throw ce
        if (uploadedUrls.length) await supabase.from('brand_past_exhibition_images').insert(uploadedUrls.map((url, i) => ({ id: crypto.randomUUID(), past_exhibition_id: id, url, display_order: i })))
      }
      await load(); setDraft(null); setEditingId(null)
    } catch (e: unknown) {
      setError((e as { message?: string })?.message ?? 'Failed to save')
    } finally { setSaving(false) }
  }

  async function deleteExhibition(id: string) {
    if (!confirm('Remove this exhibition from your history?')) return
    await supabase.from('brand_past_exhibitions').delete().eq('id', id)
    setExhibitions(prev => prev.filter(ex => ex.id !== id))
  }

  if (loading) return <div className="p-8 text-sm text-[var(--text3)]">Loading…</div>

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-xl font-bold text-[var(--text)]">Past Exhibitions</h1>
          <p className="text-sm text-[var(--text3)] mt-0.5">
            Your exhibition history — automatically populated from Designup events, or add your own
          </p>
        </div>
        {!draft && <Button onClick={startAdd} size="sm"><Plus size={14} /> Add Exhibition</Button>}
      </div>

      {/* Add / Edit form */}
      {draft && (
        <div className="bg-[var(--surface)] border border-[var(--accent)] rounded-2xl p-6 flex flex-col gap-4 mb-8">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-[var(--text)]">{editingId ? 'Edit Exhibition' : 'Add Past Exhibition'}</h3>
            <button onClick={() => { setDraft(null); setEditingId(null) }} className="text-[var(--text3)] hover:text-[var(--text)]"><X size={16} /></button>
          </div>
          <Input label="Exhibition Name" value={draft.name} onChange={e => setDraft(d => d ? { ...d, name: e.target.value } : d)} placeholder="e.g. India Design ID 2023, Maison & Objet" />
          <div className="grid grid-cols-2 gap-4">
            <Input label="City" value={draft.city} onChange={e => setDraft(d => d ? { ...d, city: e.target.value } : d)} placeholder="e.g. New Delhi" />
            <Input label="Venue" value={draft.venue} onChange={e => setDraft(d => d ? { ...d, venue: e.target.value } : d)} placeholder="e.g. NSIC Exhibition Grounds" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Start Date" type="date" value={draft.start_date} onChange={e => setDraft(d => d ? { ...d, start_date: e.target.value } : d)} />
            <Input label="End Date" type="date" value={draft.end_date} onChange={e => setDraft(d => d ? { ...d, end_date: e.target.value } : d)} />
          </div>
          <Textarea label="Notes" value={draft.description} onChange={e => setDraft(d => d ? { ...d, description: e.target.value } : d)} placeholder="Optional — highlights, awards, context…" rows={2} />

          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-[var(--text3)] mb-2 block">Booth / Event Photos</label>
            <div className="flex gap-2 flex-wrap">
              {draft.existingImages.map(img => (
                <div key={img.id} className="relative group">
                  <img src={img.url} alt="" className="w-20 h-20 object-cover rounded-lg border border-[var(--border)]" />
                  <button onClick={() => setDraft(d => d ? { ...d, existingImages: d.existingImages.filter(i => i.id !== img.id) } : d)} className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-[var(--red)] text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><X size={9} /></button>
                </div>
              ))}
              {draft.newPreviews.map((src, i) => (
                <div key={i} className="relative group">
                  <img src={src} alt="" className="w-20 h-20 object-cover rounded-lg border border-dashed border-[var(--border)]" />
                  <button onClick={() => setDraft(d => d ? { ...d, newImages: d.newImages.filter((_, j) => j !== i), newPreviews: d.newPreviews.filter((_, j) => j !== i) } : d)} className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-[var(--red)] text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><X size={9} /></button>
                </div>
              ))}
              <label className="w-20 h-20 border border-dashed border-[var(--border)] rounded-lg flex items-center justify-center cursor-pointer hover:border-[var(--accent)] transition-colors">
                <ImagePlus size={18} className="text-[var(--text3)]" />
                <input type="file" accept="image/*" multiple className="hidden" onChange={addImages} />
              </label>
            </div>
          </div>

          {error && <p className="text-xs text-[var(--red)] font-medium">{error}</p>}
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" size="sm" onClick={() => { setDraft(null); setEditingId(null) }}>Cancel</Button>
            <Button size="sm" loading={saving} onClick={save}>{editingId ? 'Save Changes' : 'Add Exhibition'}</Button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {exhibitions.length === 0 && !draft ? (
        <div className="text-center py-20 border border-dashed border-[var(--border)] rounded-2xl">
          <div className="text-3xl mb-3">🏛️</div>
          <p className="text-sm font-medium text-[var(--text2)]">No past exhibitions yet</p>
          <p className="text-xs text-[var(--text3)] mt-1 max-w-sm mx-auto">Past Designup exhibitions appear here automatically. You can also add exhibitions from outside Designup to build your profile.</p>
          <button onClick={startAdd} className="mt-4 text-sm text-[var(--accent)] hover:underline">Add your first exhibition →</button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {exhibitions.map(ex => (
            <div key={ex.id} className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 flex gap-4">
              {ex.images?.[0]?.url ? (
                <img src={ex.images[0].url} alt={ex.name} className="w-20 h-20 object-cover rounded-lg shrink-0" />
              ) : (
                <div className="w-20 h-20 bg-[var(--surface2)] rounded-lg flex items-center justify-center shrink-0">
                  <span className="text-xs text-[var(--text3)]">No photo</span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="font-semibold text-sm text-[var(--text)]">{ex.name}</div>
                  {ex.source === 'system' && (
                    <span className="text-[10px] bg-[var(--surface2)] border border-[var(--border)] text-[var(--text3)] px-2 py-0.5 rounded-full shrink-0">Designup</span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  {(ex.city || ex.venue) && (
                    <span className="flex items-center gap-1 text-xs text-[var(--text3)]">
                      <MapPin size={10} />
                      {[ex.venue, ex.city].filter(Boolean).join(', ')}
                    </span>
                  )}
                  {(ex.start_date || ex.end_date) && (
                    <span className="flex items-center gap-1 text-xs text-[var(--text3)]">
                      <Calendar size={10} />
                      {formatDateRange(ex.start_date, ex.end_date)}
                    </span>
                  )}
                </div>
                {ex.description && <p className="text-xs text-[var(--text3)] mt-1 line-clamp-2">{ex.description}</p>}
                {ex.source === 'manual' && (
                  <div className="flex gap-3 mt-2">
                    <button onClick={() => startEdit(ex)} className="flex items-center gap-1 text-xs text-[var(--text3)] hover:text-[var(--accent)] transition-colors"><Pencil size={11} /> Edit</button>
                    <button onClick={() => deleteExhibition(ex.id)} className="flex items-center gap-1 text-xs text-[var(--text3)] hover:text-[var(--red)] transition-colors"><Trash2 size={11} /> Delete</button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
