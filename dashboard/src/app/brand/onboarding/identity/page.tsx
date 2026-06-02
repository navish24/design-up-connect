'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'

const CATEGORIES = [
  'Furniture', 'Lighting', 'Flooring', 'Surfaces & Materials', 'Décor & Accessories',
  'Sanitaryware & Bath', 'Kitchen', 'Textiles & Upholstery', 'Art', 'Outdoor & Landscape',
  'Smart Home & Technology', 'Architecture & Construction', 'Other',
]

export default function IdentityPage() {
  const router = useRouter()
  const supabase = createClient()

  const [form, setForm] = useState({
    name: '',
    about: '',
    design_philosophy: '',
    category: '',
    tagline: '',
  })
  const [coverImage, setCoverImage] = useState<File | null>(null)
  const [coverPreview, setCoverPreview] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadExisting() {
      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user
      if (!user) return
      const { data: brand } = await supabase
        .from('brands')
        .select('name, about, design_philosophy, category, tagline, cover_image_url')
        .eq('admin_user_id', user.id)
        .maybeSingle()
      if (!brand) return
      setForm({
        name: brand.name ?? '',
        about: brand.about ?? '',
        design_philosophy: brand.design_philosophy ?? '',
        category: brand.category ?? '',
        tagline: brand.tagline ?? '',
      })
      if (brand.cover_image_url) setCoverPreview(brand.cover_image_url)
    }
    loadExisting()
  }, [])

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  function onImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setCoverImage(file)
    setCoverPreview(URL.createObjectURL(file))
  }

  async function uploadToCloudinary(file: File): Promise<string | null> {
    try {
      const res = await fetch('/api/upload-signed-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder: 'brand-covers', resource_type: 'image' }),
      })
      const { signature, timestamp, apiKey, cloudName, folder } = await res.json()
      if (!cloudName || cloudName === 'your_cloudinary_cloud_name') return null
      const fd = new FormData()
      fd.append('file', file)
      fd.append('signature', signature)
      fd.append('timestamp', timestamp)
      fd.append('api_key', apiKey)
      fd.append('folder', folder)
      const upload = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
        method: 'POST',
        body: fd,
      })
      const result = await upload.json()
      return result.secure_url ?? null
    } catch {
      return null
    }
  }

  async function save() {
    if (!form.name || !form.about || !form.design_philosophy || !form.category || !form.tagline) {
      setError('All fields except cover image are required')
      return
    }
    setLoading(true)
    setError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user
      if (!user) { router.push('/login'); return }
      let coverUrl: string | null = null
      if (coverImage) {
        coverUrl = await uploadToCloudinary(coverImage)
        if (!coverUrl) {
          setError('Cover image upload failed — check that Cloudinary is configured correctly (ask your admin to set CLOUDINARY_* env vars)')
          setLoading(false)
          return
        }
      }

      const payload = {
        ...form,
        ...(coverUrl ? { cover_image_url: coverUrl } : {}),
        onboarding_step: 'contact',
        admin_user_id: user.id,
      }

      // Check if brand already exists for this user
      const { data: existing } = await supabase
        .from('brands')
        .select('id')
        .eq('admin_user_id', user.id)
        .maybeSingle()

      let brandId: string
      if (existing) {
        const { error: upErr } = await supabase
          .from('brands')
          .update(payload)
          .eq('admin_user_id', user.id)
        if (upErr) throw upErr
        brandId = existing.id
      } else {
        const { data: inserted, error: inErr } = await supabase
          .from('brands')
          .insert({ ...payload, id: crypto.randomUUID() })
          .select('id')
          .single()
        if (inErr) throw inErr
        brandId = inserted.id
      }

      await supabase.from('brand_members').upsert({
        brand_id: brandId,
        user_id: user.id,
        role: 'admin',
        status: 'approved',
      }, { onConflict: 'brand_id,user_id' })

      router.push('/brand/onboarding/contact')
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : (e as { message?: string })?.message
      setError(msg ?? JSON.stringify(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="text-xs font-bold uppercase tracking-wider text-[var(--accent)] mb-1">Step 1 of 5</div>
        <h1 className="text-xl font-bold text-[var(--text)]">Brand Identity</h1>
        <p className="text-sm text-[var(--text3)] mt-1">This populates the About tab on your brand profile in the app.</p>
      </div>

      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 flex flex-col gap-5">
        <Input
          label="Brand Name"
          value={form.name}
          onChange={e => set('name', e.target.value)}
          placeholder="e.g. Lumina Lighting"
        />

        <Textarea
          label="About the Brand"
          value={form.about}
          onChange={e => set('about', e.target.value)}
          placeholder="A few sentences about your brand, heritage, and what makes you distinctive..."
          rows={4}
        />

        <Textarea
          label="Design Philosophy"
          value={form.design_philosophy}
          onChange={e => set('design_philosophy', e.target.value)}
          placeholder="What principles guide your design work?"
          rows={3}
        />

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold uppercase tracking-wider text-[var(--text3)]">Category</label>
          <select value={form.category} onChange={e => set('category', e.target.value)}>
            <option value="">Select a category...</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <Input
          label="Brand Tagline"
          value={form.tagline}
          onChange={e => set('tagline', e.target.value)}
          placeholder="Max 150 characters"
          maxLength={150}
        />

        {/* Cover image */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold uppercase tracking-wider text-[var(--text3)]">Brand Cover Image</label>
          {coverPreview ? (
            <div className="relative">
              <img src={coverPreview} alt="Cover preview" className="w-full h-40 object-cover rounded-xl" />
              <button
                onClick={() => { setCoverImage(null); setCoverPreview('') }}
                className="absolute top-2 right-2 bg-[var(--surface)] text-[var(--text2)] text-xs px-2 py-1 rounded-lg border border-[var(--border)]"
              >
                Remove
              </button>
            </div>
          ) : (
            <label className="border border-dashed border-[var(--border)] rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer hover:border-[var(--accent)] transition-colors">
              <span className="text-2xl mb-2">📷</span>
              <span className="text-sm text-[var(--text2)]">Click to upload cover image</span>
              <span className="text-xs text-[var(--text3)] mt-1">JPG, PNG · Recommended 1600×900</span>
              <input type="file" accept="image/*" className="hidden" onChange={onImageChange} />
            </label>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-[var(--red-dim)] border border-[var(--red)] rounded-xl px-4 py-3 text-sm text-[var(--red)]">
          {error}
        </div>
      )}

      <div className="flex justify-end">
        <Button onClick={save} loading={loading} size="lg">
          Save & Continue →
        </Button>
      </div>
    </div>
  )
}
