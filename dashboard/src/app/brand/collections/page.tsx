'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { Plus, X, ImagePlus, Trash2, Pencil } from 'lucide-react'

interface CollectionImage { id: string; url: string; display_order: number }
interface Collection {
  id: string; brand_id: string; name: string; description: string | null
  display_order: number; created_at: string
  images: CollectionImage[]
}

interface Draft {
  name: string; description: string
  newImages: File[]; newPreviews: string[]
  existingImages: CollectionImage[]
}

async function uploadImage(file: File): Promise<string | null> {
  try {
    const res = await fetch('/api/upload-signed-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folder: 'collections', resource_type: 'image' }),
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

export default function CollectionsPage() {
  const supabase = createClient()
  const [collections, setCollections] = useState<Collection[]>([])
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
    const { data } = await supabase
      .from('collections').select('*, images:collection_images(*)')
      .eq('brand_id', brand.id).order('display_order')
    setCollections((data as Collection[]) ?? [])
    setLoading(false)
  }

  const emptyDraft = (): Draft => ({ name: '', description: '', newImages: [], newPreviews: [], existingImages: [] })

  function startAdd() { setEditingId(null); setDraft(emptyDraft()); setError('') }

  function startEdit(c: Collection) {
    setEditingId(c.id)
    setDraft({ name: c.name, description: c.description ?? '', newImages: [], newPreviews: [], existingImages: c.images ?? [] })
    setError('')
  }

  function addImages(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length || !draft) return
    setDraft(d => d ? { ...d, newImages: [...d.newImages, ...files], newPreviews: [...d.newPreviews, ...files.map(f => URL.createObjectURL(f))] } : d)
  }

  async function save() {
    if (!draft?.name) { setError('Collection name is required'); return }
    setSaving(true); setError('')
    try {
      const uploadedUrls = (await Promise.all(draft.newImages.map(uploadImage))).filter((u): u is string => u !== null)

      if (editingId) {
        await supabase.from('collections').update({ name: draft.name, description: draft.description }).eq('id', editingId)
        const existing = collections.find(c => c.id === editingId)
        const removedIds = (existing?.images ?? []).filter(img => !draft.existingImages.find(e => e.id === img.id)).map(img => img.id)
        if (removedIds.length) await supabase.from('collection_images').delete().in('id', removedIds)
        if (uploadedUrls.length) await supabase.from('collection_images').insert(uploadedUrls.map((url, i) => ({ id: crypto.randomUUID(), collection_id: editingId, url, display_order: draft.existingImages.length + i })))
      } else {
        const id = crypto.randomUUID()
        const { error: ce } = await supabase.from('collections').insert({ id, brand_id: brandId, name: draft.name, description: draft.description, display_order: collections.length })
        if (ce) throw ce
        if (uploadedUrls.length) await supabase.from('collection_images').insert(uploadedUrls.map((url, i) => ({ id: crypto.randomUUID(), collection_id: id, url, display_order: i })))
      }
      await load(); setDraft(null); setEditingId(null)
    } catch (e: unknown) {
      setError((e as { message?: string })?.message ?? 'Failed to save')
    } finally { setSaving(false) }
  }

  async function deleteCollection(id: string) {
    if (!confirm('Delete this collection?')) return
    await supabase.from('collections').delete().eq('id', id)
    setCollections(prev => prev.filter(c => c.id !== id))
  }

  if (loading) return <div className="p-8 text-sm text-[var(--text3)]">Loading…</div>

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-xl font-bold text-[var(--text)]">Collections</h1>
          <p className="text-sm text-[var(--text3)] mt-0.5">
            Curated product groupings — shown under the Collections tab in the app
          </p>
        </div>
        {!draft && <Button onClick={startAdd} size="sm"><Plus size={14} /> Add Collection</Button>}
      </div>

      {/* Add / Edit form */}
      {draft && (
        <div className="bg-[var(--surface)] border border-[var(--accent)] rounded-2xl p-6 flex flex-col gap-4 mb-8">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-[var(--text)]">{editingId ? 'Edit Collection' : 'New Collection'}</h3>
            <button onClick={() => { setDraft(null); setEditingId(null) }} className="text-[var(--text3)] hover:text-[var(--text)]"><X size={16} /></button>
          </div>
          <Input label="Collection Name" value={draft.name} onChange={e => setDraft(d => d ? { ...d, name: e.target.value } : d)} placeholder="e.g. Summer 2025, Minimalist Living" />
          <Textarea label="Description" value={draft.description} onChange={e => setDraft(d => d ? { ...d, description: e.target.value } : d)} placeholder="What defines this collection — theme, mood, material story…" rows={2} />

          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-[var(--text3)] mb-2 block">Images</label>
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
            <Button size="sm" loading={saving} onClick={save}>{editingId ? 'Save Changes' : 'Add Collection'}</Button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {collections.length === 0 && !draft ? (
        <div className="text-center py-20 border border-dashed border-[var(--border)] rounded-2xl">
          <div className="text-3xl mb-3">🗂️</div>
          <p className="text-sm font-medium text-[var(--text2)]">No collections yet</p>
          <p className="text-xs text-[var(--text3)] mt-1 max-w-xs mx-auto">Group your products into themed collections — they appear under the Collections tab on your brand page in the app.</p>
          <button onClick={startAdd} className="mt-4 text-sm text-[var(--accent)] hover:underline">Add your first collection →</button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {collections.map(c => (
            <div key={c.id} className="bg-[var(--surface)] border border-[var(--border)] rounded-xl overflow-hidden">
              {c.images?.[0]?.url ? (
                <img src={c.images[0].url} alt={c.name} className="w-full h-36 object-cover" />
              ) : (
                <div className="w-full h-36 bg-[var(--surface2)] flex items-center justify-center"><span className="text-xs text-[var(--text3)]">No images</span></div>
              )}
              <div className="p-3">
                <div className="font-semibold text-sm text-[var(--text)]">{c.name}</div>
                {c.description && <div className="text-xs text-[var(--text3)] mt-0.5 line-clamp-2">{c.description}</div>}
                {c.images?.length > 0 && <div className="text-xs text-[var(--text3)] mt-0.5">{c.images.length} image{c.images.length !== 1 ? 's' : ''}</div>}
                <div className="flex gap-3 mt-3">
                  <button onClick={() => startEdit(c)} className="flex items-center gap-1 text-xs text-[var(--text3)] hover:text-[var(--accent)] transition-colors"><Pencil size={11} /> Edit</button>
                  <button onClick={() => deleteCollection(c.id)} className="flex items-center gap-1 text-xs text-[var(--text3)] hover:text-[var(--red)] transition-colors"><Trash2 size={11} /> Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
