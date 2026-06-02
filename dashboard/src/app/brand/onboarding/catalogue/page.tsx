'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { Plus, X, ImagePlus, CheckCircle2 } from 'lucide-react'
import type { Product } from '@/lib/types'

const MIN_PRODUCTS = 5

interface ProductDraft {
  name: string
  material: string
  dimensions: string
  colour: string
  customisation_details: string
  images: File[]
  imagePreviews: string[]
}

const emptyDraft = (): ProductDraft => ({
  name: '', material: '', dimensions: '', colour: '', customisation_details: '',
  images: [], imagePreviews: [],
})

function isComplete(p: ProductDraft) {
  return p.name && p.material && p.dimensions && p.colour && p.customisation_details && p.images.length > 0
}

export default function CataloguePage() {
  const router = useRouter()
  const supabase = createClient()

  const [savedProducts, setSavedProducts] = useState<Product[]>([])
  const [draft, setDraft] = useState<ProductDraft | null>(null)
  const [saving, setSaving] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [brandId, setBrandId] = useState<string>('')

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user
      const { data: brand } = await supabase.from('brands').select('id').eq('admin_user_id', user!.id).single()
      if (!brand) return
      setBrandId(brand.id)
      const { data: products } = await supabase
        .from('products')
        .select('*, images:product_images(*)')
        .eq('brand_id', brand.id)
        .order('display_order')
      setSavedProducts((products as Product[]) ?? [])
    }
    load()
  }, [])

  function setDraftField(field: keyof ProductDraft, value: string) {
    setDraft(d => d ? { ...d, [field]: value } : d)
  }

  function onImageAdd(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length || !draft) return
    const previews = files.map(f => URL.createObjectURL(f))
    setDraft(d => d ? { ...d, images: [...d.images, ...files], imagePreviews: [...d.imagePreviews, ...previews] } : d)
  }

  async function uploadImage(file: File): Promise<string | null> {
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
      const up = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: 'POST', body: fd })
      const result = await up.json()
      return result.secure_url ?? null
    } catch {
      return null
    }
  }

  async function saveProduct() {
    if (!draft) return
    const errors: Record<string, string> = {}
    if (!draft.name) errors.name = 'Product name is required'
    if (!draft.material) errors.material = 'Material is required'
    if (!draft.colour) errors.colour = 'Colour is required'
    if (!draft.dimensions) errors.dimensions = 'Dimensions are required'
    if (!draft.customisation_details) errors.customisation_details = 'Customisation details are required'
    if (draft.images.length === 0) errors.images = 'At least one product image is required'
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }
    setSaving(true)
    setFieldErrors({})
    try {
      const uploadResults = await Promise.all(draft.images.map(f => uploadImage(f)))
      const imageUrls = uploadResults.filter((u): u is string => u !== null)

      if (draft.images.length > 0 && imageUrls.length === 0) {
        setFieldErrors({ images: 'Image upload failed — Cloudinary is not configured. Ask your admin to set up CLOUDINARY_* env vars.' })
        setSaving(false)
        return
      }

      const { data: product, error: pe } = await supabase
        .from('products')
        .insert({
          id: crypto.randomUUID(),
          brand_id: brandId,
          name: draft.name,
          material: draft.material,
          dimensions: draft.dimensions,
          colour: draft.colour,
          customisation_details: draft.customisation_details,
          display_order: savedProducts.length,
        })
        .select()
        .single()
      if (pe) throw pe

      if (imageUrls.length > 0) {
        await supabase.from('product_images').insert(
          imageUrls.map((url, i) => ({ product_id: product.id, url, display_order: i }))
        )
      }

      setSavedProducts(prev => [...prev, { ...product, images: imageUrls.map((url, i) => ({ id: '', product_id: product.id, url, display_order: i })) }])
      setDraft(null)
    } catch (e: unknown) {
      const msg = (e as { message?: string })?.message ?? 'Failed to save product'
      setFieldErrors({ general: msg })
    } finally {
      setSaving(false)
    }
  }

  async function deleteProduct(id: string) {
    await supabase.from('products').delete().eq('id', id)
    setSavedProducts(prev => prev.filter(p => p.id !== id))
  }

  async function proceed() {
    if (savedProducts.length < MIN_PRODUCTS) {
      setFieldErrors({ general: `You need at least ${MIN_PRODUCTS} complete products to continue` })
      return
    }
    setSubmitting(true)
    const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user
    await supabase.from('brands').update({ onboarding_step: 'representatives' }).eq('admin_user_id', user!.id)
    router.push('/brand/onboarding/representatives')
  }

  const remaining = Math.max(0, MIN_PRODUCTS - savedProducts.length)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="text-xs font-bold uppercase tracking-wider text-[var(--accent)] mb-1">Step 3 of 5</div>
        <h1 className="text-xl font-bold text-[var(--text)]">Catalogue</h1>
        <p className="text-sm text-[var(--text3)] mt-1">Minimum 5 complete products required before your QR is generated.</p>
      </div>

      {/* Progress bar */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-semibold text-[var(--text)]">{savedProducts.length} of {MIN_PRODUCTS} products added</span>
          {savedProducts.length >= MIN_PRODUCTS && (
            <span className="flex items-center gap-1 text-xs text-[var(--green)]">
              <CheckCircle2 size={13} /> Minimum met
            </span>
          )}
        </div>
        <div className="h-2 bg-[var(--surface2)] rounded-full overflow-hidden">
          <div
            className="h-full bg-[var(--accent)] rounded-full transition-all"
            style={{ width: `${Math.min(100, (savedProducts.length / MIN_PRODUCTS) * 100)}%` }}
          />
        </div>
        {remaining > 0 && (
          <p className="text-xs text-[var(--text3)] mt-2">{remaining} more product{remaining !== 1 ? 's' : ''} needed</p>
        )}
      </div>

      {/* Saved products grid */}
      {savedProducts.length > 0 && (
        <div className="grid grid-cols-2 gap-4">
          {savedProducts.map(p => (
            <div key={p.id} className="bg-[var(--surface)] border border-[var(--border)] rounded-xl overflow-hidden">
              {p.images?.[0]?.url && (
                <img src={p.images[0].url} alt={p.name} className="w-full h-32 object-cover" />
              )}
              <div className="p-3">
                <div className="font-semibold text-sm text-[var(--text)]">{p.name}</div>
                <div className="text-xs text-[var(--text3)] mt-0.5">{p.material} · {p.colour}</div>
                <button
                  onClick={() => deleteProduct(p.id)}
                  className="mt-2 text-xs text-[var(--red)] hover:underline"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add product button */}
      {!draft && (
        <button
          onClick={() => setDraft(emptyDraft())}
          className="flex items-center gap-2 p-4 border border-dashed border-[var(--border)] rounded-2xl text-[var(--text2)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
        >
          <Plus size={18} />
          <span className="text-sm font-medium">Add Product</span>
        </button>
      )}

      {/* Product draft form */}
      {draft && (
        <div className="bg-[var(--surface)] border border-[var(--accent)] rounded-2xl p-6 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-[var(--text)]">New Product</h3>
            <button onClick={() => setDraft(null)} className="text-[var(--text3)] hover:text-[var(--text)]">
              <X size={16} />
            </button>
          </div>

          <div className="flex flex-col gap-1">
            <Input
              label="Product Name"
              value={draft.name}
              onChange={e => { setDraftField('name', e.target.value); setFieldErrors(fe => ({ ...fe, name: '' })) }}
              placeholder="e.g. Orbit Pendant Light"
            />
            {fieldErrors.name && <p className="text-xs text-[var(--red)] font-medium">{fieldErrors.name}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <Input label="Material" value={draft.material} onChange={e => { setDraftField('material', e.target.value); setFieldErrors(fe => ({ ...fe, material: '' })) }} placeholder="e.g. Brass, Marble" />
              {fieldErrors.material && <p className="text-xs text-[var(--red)] font-medium">{fieldErrors.material}</p>}
            </div>
            <div className="flex flex-col gap-1">
              <Input label="Colour" value={draft.colour} onChange={e => { setDraftField('colour', e.target.value); setFieldErrors(fe => ({ ...fe, colour: '' })) }} placeholder="e.g. Gold, Black" />
              {fieldErrors.colour && <p className="text-xs text-[var(--red)] font-medium">{fieldErrors.colour}</p>}
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <Input label="Dimensions" value={draft.dimensions} onChange={e => { setDraftField('dimensions', e.target.value); setFieldErrors(fe => ({ ...fe, dimensions: '' })) }} placeholder="e.g. H: 40cm, W: 25cm" />
            {fieldErrors.dimensions && <p className="text-xs text-[var(--red)] font-medium">{fieldErrors.dimensions}</p>}
          </div>

          <div className="flex flex-col gap-1">
            <Textarea
              label="Customisation Details"
              value={draft.customisation_details}
              onChange={e => { setDraftField('customisation_details', e.target.value); setFieldErrors(fe => ({ ...fe, customisation_details: '' })) }}
              placeholder="What can be customised — colours, sizes, finishes..."
              rows={2}
            />
            {fieldErrors.customisation_details && <p className="text-xs text-[var(--red)] font-medium">{fieldErrors.customisation_details}</p>}
          </div>

          {/* Images */}
          <div className={[
            'rounded-xl p-3 -m-3 transition-colors',
            fieldErrors.images ? 'bg-[var(--red-dim)] border border-[var(--red)]' : '',
          ].join(' ')}>
            <label className={[
              'text-xs font-bold uppercase tracking-wider mb-2 block',
              fieldErrors.images ? 'text-[var(--red)]' : 'text-[var(--text3)]',
            ].join(' ')}>
              Product Images (min 1)
            </label>
            <div className="flex gap-2 flex-wrap">
              {draft.imagePreviews.map((src, i) => (
                <img key={i} src={src} alt="" className="w-16 h-16 object-cover rounded-lg border border-[var(--border)]" />
              ))}
              <label className={[
                'w-16 h-16 border border-dashed rounded-lg flex items-center justify-center cursor-pointer transition-colors',
                fieldErrors.images
                  ? 'border-[var(--red)] bg-[var(--red-dim)] hover:border-[var(--red)]'
                  : 'border-[var(--border)] hover:border-[var(--accent)]',
              ].join(' ')}
              onClick={() => setFieldErrors(fe => ({ ...fe, images: '' }))}
              >
                <ImagePlus size={18} className={fieldErrors.images ? 'text-[var(--red)]' : 'text-[var(--text3)]'} />
                <input type="file" accept="image/*" multiple className="hidden" onChange={onImageAdd} />
              </label>
            </div>
            {fieldErrors.images && (
              <p className="text-xs text-[var(--red)] font-medium mt-2">{fieldErrors.images}</p>
            )}
          </div>

          {fieldErrors.general && (
            <div className="bg-[var(--red-dim)] border border-[var(--red)] rounded-xl px-4 py-3 text-sm text-[var(--red)] font-medium">
              {fieldErrors.general}
            </div>
          )}

          <Button onClick={saveProduct} loading={saving} size="sm">
            Save Product
          </Button>
        </div>
      )}

      <div className="flex justify-between">
        <Button variant="ghost" onClick={() => router.push('/brand/onboarding/contact')}>← Back</Button>
        <Button onClick={proceed} loading={submitting} disabled={savedProducts.length < MIN_PRODUCTS} size="lg">
          Save & Continue →
        </Button>
      </div>
    </div>
  )
}
