'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { Plus, X, ImagePlus, Pencil, Trash2 } from 'lucide-react'
import type { Product } from '@/lib/types'

interface ProductDraft {
  name: string
  description: string
  material: string
  dimensions: string
  colour: string
  customisation_details: string
  newImages: File[]
  newImagePreviews: string[]
  existingImages: { id: string; url: string; display_order: number }[]
}

const emptyDraft = (): ProductDraft => ({
  name: '', description: '', material: '', dimensions: '', colour: '', customisation_details: '',
  newImages: [], newImagePreviews: [], existingImages: [],
})

async function uploadToCloudinary(file: File): Promise<string | null> {
  try {
    const res = await fetch('/api/upload-signed-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folder: 'products', resource_type: 'image' }),
    })
    const { signature, timestamp, apiKey, cloudName, folder } = await res.json()
    if (!cloudName || cloudName === 'your_cloudinary_cloud_name') return null
    const fd = new FormData()
    fd.append('file', file)
    fd.append('signature', signature)
    fd.append('timestamp', String(timestamp))
    fd.append('api_key', apiKey)
    fd.append('folder', folder)
    const upload = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: 'POST', body: fd })
    const result = await upload.json()
    return result.secure_url ?? null
  } catch {
    return null
  }
}

export default function CataloguePage() {
  const supabase = createClient()

  const [products, setProducts] = useState<Product[]>([])
  const [brandId, setBrandId] = useState('')
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState<ProductDraft | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user
    const { data: brand } = await supabase.from('brands').select('id').eq('admin_user_id', user!.id).single()
    if (!brand) { setLoading(false); return }
    setBrandId(brand.id)

    const { data } = await supabase
      .from('products')
      .select('*, images:product_images(*)')
      .eq('brand_id', brand.id)
      .order('display_order')
    setProducts((data as Product[]) ?? [])
    setLoading(false)
  }

  function startAdd() {
    setEditingId(null)
    setDraft(emptyDraft())
    setError('')
  }

  function startEdit(p: Product) {
    setEditingId(p.id)
    setDraft({
      name: p.name,
      description: p.description ?? '',
      material: p.material ?? '',
      dimensions: p.dimensions ?? '',
      colour: p.colour ?? '',
      customisation_details: p.customisation_details ?? '',
      newImages: [],
      newImagePreviews: [],
      existingImages: p.images ?? [],
    })
    setError('')
  }

  function cancelDraft() {
    setDraft(null)
    setEditingId(null)
    setError('')
  }

  function setField(field: keyof ProductDraft, value: string) {
    setDraft(d => d ? { ...d, [field]: value } : d)
  }

  function onImageAdd(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length || !draft) return
    const previews = files.map(f => URL.createObjectURL(f))
    setDraft(d => d ? {
      ...d,
      newImages: [...d.newImages, ...files],
      newImagePreviews: [...d.newImagePreviews, ...previews],
    } : d)
  }

  function removeExistingImage(imageId: string) {
    setDraft(d => d ? { ...d, existingImages: d.existingImages.filter(img => img.id !== imageId) } : d)
  }

  function removeNewImage(idx: number) {
    setDraft(d => d ? {
      ...d,
      newImages: d.newImages.filter((_, i) => i !== idx),
      newImagePreviews: d.newImagePreviews.filter((_, i) => i !== idx),
    } : d)
  }

  async function save() {
    if (!draft || !draft.name) { setError('Product name is required'); return }
    setSaving(true)
    setError('')
    try {
      const uploadedUrls = await Promise.all(
        draft.newImages.map(f => uploadToCloudinary(f))
      )

      if (editingId) {
        // Update existing product
        await supabase.from('products').update({
          name: draft.name,
          description: draft.description,
          material: draft.material,
          dimensions: draft.dimensions,
          colour: draft.colour,
          customisation_details: draft.customisation_details,
        }).eq('id', editingId)

        // Delete removed images
        const existingProduct = products.find(p => p.id === editingId)
        const removedIds = (existingProduct?.images ?? [])
          .filter(img => !draft.existingImages.find(e => e.id === img.id))
          .map(img => img.id)
        if (removedIds.length > 0) {
          await supabase.from('product_images').delete().in('id', removedIds)
        }

        // Add new images
        const nextOrder = draft.existingImages.length
        const newImageRows = uploadedUrls
          .filter((url): url is string => url !== null)
          .map((url, i) => ({ product_id: editingId, url, display_order: nextOrder + i }))
        if (newImageRows.length > 0) {
          await supabase.from('product_images').insert(newImageRows)
        }
      } else {
        // Insert new product
        const { data: product, error: pe } = await supabase
          .from('products')
          .insert({
            id: crypto.randomUUID(),
            brand_id: brandId,
            name: draft.name,
            description: draft.description,
            material: draft.material,
            dimensions: draft.dimensions,
            colour: draft.colour,
            customisation_details: draft.customisation_details,
            display_order: products.length,
          })
          .select()
          .single()
        if (pe) throw pe

        const imageRows = uploadedUrls
          .filter((url): url is string => url !== null)
          .map((url, i) => ({ product_id: product.id, url, display_order: i }))
        if (imageRows.length > 0) {
          await supabase.from('product_images').insert(imageRows)
        }
      }

      await load()
      setDraft(null)
      setEditingId(null)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  async function deleteProduct(id: string) {
    await supabase.from('products').delete().eq('id', id)
    setProducts(prev => prev.filter(p => p.id !== id))
  }

  if (loading) return <div className="p-8 text-sm text-[var(--text3)]">Loading…</div>

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-xl font-bold text-[var(--text)]">Catalogue</h1>
          <p className="text-sm text-[var(--text3)] mt-0.5">{products.length} product{products.length !== 1 ? 's' : ''}</p>
        </div>
        {!draft && (
          <Button onClick={startAdd} size="sm">
            <Plus size={14} /> Add Product
          </Button>
        )}
      </div>

      {/* Add / Edit form */}
      {draft && (
        <div className="bg-[var(--surface)] border border-[var(--accent)] rounded-2xl p-6 flex flex-col gap-4 mb-8">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-[var(--text)]">
              {editingId ? 'Edit Product' : 'New Product'}
            </h3>
            <button onClick={cancelDraft} className="text-[var(--text3)] hover:text-[var(--text)]">
              <X size={16} />
            </button>
          </div>

          <Input
            label="Product Name"
            value={draft.name}
            onChange={e => setField('name', e.target.value)}
            placeholder="e.g. Orbit Pendant Light"
          />
          <Textarea
            label="Product Description"
            value={draft.description}
            onChange={e => setField('description', e.target.value)}
            placeholder="Describe the product — its design intent, use case, and what makes it distinctive..."
            rows={3}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Material" value={draft.material} onChange={e => setField('material', e.target.value)} placeholder="e.g. Brass, Marble" />
            <Input label="Colour" value={draft.colour} onChange={e => setField('colour', e.target.value)} placeholder="e.g. Gold, Matte Black" />
          </div>
          <Input label="Dimensions" value={draft.dimensions} onChange={e => setField('dimensions', e.target.value)} placeholder="e.g. H: 40cm, W: 25cm" />
          <Textarea
            label="Customisation Details"
            value={draft.customisation_details}
            onChange={e => setField('customisation_details', e.target.value)}
            placeholder="What can be customised — colours, sizes, finishes..."
            rows={2}
          />

          {/* Images */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-[var(--text3)] mb-2 block">
              Product Images
            </label>
            <div className="flex gap-2 flex-wrap">
              {/* Existing images */}
              {draft.existingImages.map(img => (
                <div key={img.id} className="relative group">
                  <img src={img.url} alt="" className="w-16 h-16 object-cover rounded-lg border border-[var(--border)]" />
                  <button
                    onClick={() => removeExistingImage(img.id)}
                    className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-[var(--red)] text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X size={9} />
                  </button>
                </div>
              ))}
              {/* New image previews */}
              {draft.newImagePreviews.map((src, i) => (
                <div key={`new-${i}`} className="relative group">
                  <img src={src} alt="" className="w-16 h-16 object-cover rounded-lg border border-[var(--border)] border-dashed" />
                  <button
                    onClick={() => removeNewImage(i)}
                    className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-[var(--red)] text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X size={9} />
                  </button>
                </div>
              ))}
              <label className="w-16 h-16 border border-dashed border-[var(--border)] rounded-lg flex items-center justify-center cursor-pointer hover:border-[var(--accent)] transition-colors">
                <ImagePlus size={18} className="text-[var(--text3)]" />
                <input type="file" accept="image/*" multiple className="hidden" onChange={onImageAdd} />
              </label>
            </div>
          </div>

          {error && <p className="text-xs text-[var(--red)]">{error}</p>}

          <div className="flex gap-2 justify-end">
            <Button variant="secondary" size="sm" onClick={cancelDraft}>Cancel</Button>
            <Button size="sm" loading={saving} onClick={save}>
              {editingId ? 'Save Changes' : 'Add Product'}
            </Button>
          </div>
        </div>
      )}

      {/* Product grid */}
      {products.length === 0 && !draft ? (
        <div className="text-center py-16 border border-dashed border-[var(--border)] rounded-2xl">
          <p className="text-sm text-[var(--text3)]">No products yet.</p>
          <button onClick={startAdd} className="mt-3 text-sm text-[var(--accent)] hover:underline">
            Add your first product →
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          {products.map(p => (
            <div key={p.id} className="bg-[var(--surface)] border border-[var(--border)] rounded-xl overflow-hidden group">
              {p.images?.[0]?.url ? (
                <img src={p.images[0].url} alt={p.name} className="w-full h-36 object-cover" />
              ) : (
                <div className="w-full h-36 bg-[var(--surface2)] flex items-center justify-center">
                  <span className="text-xs text-[var(--text3)]">No image</span>
                </div>
              )}
              <div className="p-3">
                <div className="font-semibold text-sm text-[var(--text)] truncate">{p.name}</div>
                {p.description && (
                  <div className="text-xs text-[var(--text2)] mt-1 line-clamp-2 leading-relaxed">{p.description}</div>
                )}
                <div className="text-xs text-[var(--text3)] mt-1 truncate">
                  {[p.material, p.colour].filter(Boolean).join(' · ') || 'No details'}
                </div>
                {p.images && p.images.length > 1 && (
                  <div className="text-xs text-[var(--text3)] mt-0.5">{p.images.length} images</div>
                )}
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => startEdit(p)}
                    className="flex items-center gap-1 text-xs text-[var(--text3)] hover:text-[var(--accent)] transition-colors"
                  >
                    <Pencil size={11} /> Edit
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Delete "${p.name}"?`)) deleteProduct(p.id)
                    }}
                    className="flex items-center gap-1 text-xs text-[var(--text3)] hover:text-[var(--red)] transition-colors"
                  >
                    <Trash2 size={11} /> Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
