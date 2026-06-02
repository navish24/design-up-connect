'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { Upload, Check } from 'lucide-react'

const CATEGORIES = [
  'Furniture', 'Lighting', 'Textiles', 'Flooring', 'Kitchen & Bath',
  'Outdoor', 'Accessories', 'Art', 'Wallcovering', 'Storage',
  'Audio Visual', 'Smart Home', 'Other',
]

interface BrandData {
  id: string
  name: string
  about: string
  design_philosophy: string
  category: string
  tagline: string
  cover_image_url: string
  contact_name: string
  contact_email: string
  contact_phone: string
  website: string
  city: string
  service_location: string
}

export default function BrandProfilePage() {
  const supabase = createClient()
  const fileRef = useRef<HTMLInputElement>(null)

  const [brand, setBrand] = useState<BrandData | null>(null)
  const [form, setForm] = useState<Partial<BrandData>>({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user
    const { data: member } = await supabase
      .from('brand_members')
      .select('brand_id')
      .eq('user_id', user!.id)
      .eq('role', 'admin')
      .single()
    if (!member) return

    const { data } = await supabase.from('brands').select('*').eq('id', member.brand_id).single()
    setBrand(data)
    setForm(data ?? {})
  }

  function set(field: keyof BrandData, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function uploadCover(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setUploadError('')
    try {
      const res = await fetch('/api/upload-signed-url', {
        method: 'POST',
        body: JSON.stringify({ folder: 'covers', resource_type: 'image' }),
        headers: { 'Content-Type': 'application/json' },
      })
      const { signature, timestamp, cloudName, apiKey, folder } = await res.json()
      if (!cloudName || cloudName === 'your_cloudinary_cloud_name') {
        setUploadError('Image upload failed — Cloudinary is not configured')
        return
      }
      const fd = new FormData()
      fd.append('file', file)
      fd.append('signature', signature)
      fd.append('timestamp', String(timestamp))
      fd.append('api_key', apiKey)
      fd.append('folder', folder)
      const upload = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: 'POST', body: fd })
      const { secure_url } = await upload.json()
      if (!secure_url) { setUploadError('Upload failed — please try again'); return }
      set('cover_image_url', secure_url)
    } catch {
      setUploadError('Upload failed — please try again')
    } finally {
      setUploading(false)
    }
  }

  async function save() {
    if (!brand) return
    if (uploading) return
    setSaving(true)
    await supabase.from('brands').update(form).eq('id', brand.id)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  if (!brand) return <div className="p-8 text-sm text-[var(--text3)]">Loading…</div>

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-xl font-bold text-[var(--text)]">Brand Profile</h1>
          <p className="text-sm text-[var(--text3)] mt-0.5">Edit your brand information</p>
        </div>
        <Button onClick={save} loading={saving} disabled={saving || saved} className="min-w-[130px]">
          {saved ? <><Check size={14} /> Saved</> : 'Save Changes'}
        </Button>
      </div>

      {/* Cover image */}
      <div className="mb-6">
        <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text3)] mb-2">Cover Image</label>
        <div
          className="relative rounded-2xl overflow-hidden bg-[var(--surface2)] border border-[var(--border)] cursor-pointer group"
          style={{ height: '180px' }}
          onClick={() => fileRef.current?.click()}
        >
          {form.cover_image_url ? (
            <img src={form.cover_image_url} alt="cover" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Upload size={24} className="text-[var(--text3)]" />
            </div>
          )}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <span className="text-white text-sm font-medium">{uploading ? 'Uploading…' : 'Change Cover'}</span>
          </div>
        </div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={uploadCover} />
        {uploadError && <p className="text-xs text-[var(--red)] mt-1">{uploadError}</p>}
      </div>

      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 flex flex-col gap-5 mb-6">
        <h2 className="text-sm font-bold text-[var(--text3)] uppercase tracking-wider">Identity</h2>
        <Input label="Brand Name" value={form.name ?? ''} onChange={e => set('name', e.target.value)} />
        <Input label="Tagline" value={form.tagline ?? ''} onChange={e => set('tagline', e.target.value)} placeholder="One line that defines you" />
        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold uppercase tracking-wider text-[var(--text3)]">Category</label>
          <select value={form.category ?? ''} onChange={e => set('category', e.target.value)}>
            <option value="">Select category</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <Textarea label="About" value={form.about ?? ''} onChange={e => set('about', e.target.value)} rows={3} placeholder="Tell the world about your brand" />
        <Textarea label="Design Philosophy" value={form.design_philosophy ?? ''} onChange={e => set('design_philosophy', e.target.value)} rows={3} placeholder="What drives your creative vision?" />
      </div>

      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 flex flex-col gap-5">
        <h2 className="text-sm font-bold text-[var(--text3)] uppercase tracking-wider">Contact & Location</h2>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Contact Name" value={form.contact_name ?? ''} onChange={e => set('contact_name', e.target.value)} />
          <Input label="Contact Email" value={form.contact_email ?? ''} onChange={e => set('contact_email', e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Phone" value={form.contact_phone ?? ''} onChange={e => set('contact_phone', e.target.value)} />
          <Input label="Website" value={form.website ?? ''} onChange={e => set('website', e.target.value)} placeholder="https://..." />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input label="City" value={form.city ?? ''} onChange={e => set('city', e.target.value)} />
          <Input label="Service Location" value={form.service_location ?? ''} onChange={e => set('service_location', e.target.value)} placeholder="e.g. Pan India, Mumbai" />
        </div>
      </div>
    </div>
  )
}
