'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

export default function ContactPage() {
  const router = useRouter()
  const supabase = createClient()

  const [form, setForm] = useState({
    contact_name: '',
    contact_email: '',
    contact_phone: '',
    website: '',
    city: '',
    service_location: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadExisting() {
      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user
      if (!user) return
      const { data: brand } = await supabase
        .from('brands')
        .select('contact_name, contact_email, contact_phone, website, city, service_location')
        .eq('admin_user_id', user.id)
        .maybeSingle()
      if (!brand) return
      setForm({
        contact_name: brand.contact_name ?? '',
        contact_email: brand.contact_email ?? '',
        contact_phone: brand.contact_phone ?? '',
        website: brand.website ?? '',
        city: brand.city ?? '',
        service_location: brand.service_location ?? '',
      })
    }
    loadExisting()
  }, [])

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function save() {
    if (!form.contact_name || !form.contact_email || !form.contact_phone || !form.city) {
      setError('Name, email, phone, and city are required')
      return
    }
    setLoading(true)
    setError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user

      const { error: err } = await supabase
        .from('brands')
        .update({ ...form, onboarding_step: 'catalogue' })
        .eq('admin_user_id', user!.id)

      if (err) throw err
      router.push('/brand/onboarding/catalogue')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="text-xs font-bold uppercase tracking-wider text-[var(--accent)] mb-1">Step 2 of 5</div>
        <h1 className="text-xl font-bold text-[var(--text)]">Contact & Location</h1>
        <p className="text-sm text-[var(--text3)] mt-1">Used for QR generation and surfaces on your brand About tab.</p>
      </div>

      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 flex flex-col gap-5">
        <Input
          label="Contact Name"
          value={form.contact_name}
          onChange={e => set('contact_name', e.target.value)}
          placeholder="Full name of primary contact"
        />
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Email Address"
            type="email"
            value={form.contact_email}
            onChange={e => set('contact_email', e.target.value)}
            placeholder="contact@brand.com"
          />
          <Input
            label="Phone Number"
            type="tel"
            value={form.contact_phone}
            onChange={e => set('contact_phone', e.target.value)}
            placeholder="+91 ..."
          />
        </div>
        <Input
          label="Website"
          type="url"
          value={form.website}
          onChange={e => set('website', e.target.value)}
          placeholder="https://yourbrand.com"
        />
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="City"
            value={form.city}
            onChange={e => set('city', e.target.value)}
            placeholder="e.g. Mumbai"
          />
          <Input
            label="Service Location"
            value={form.service_location}
            onChange={e => set('service_location', e.target.value)}
            placeholder="e.g. Pan India, Mumbai & Pune"
          />
        </div>
      </div>

      {error && (
        <div className="bg-[var(--red-dim)] border border-[var(--red)] rounded-xl px-4 py-3 text-sm text-[var(--red)]">
          {error}
        </div>
      )}

      <div className="flex justify-between">
        <Button variant="ghost" onClick={() => router.push('/brand/onboarding/identity')}>← Back</Button>
        <Button onClick={save} loading={loading} size="lg">Save & Continue →</Button>
      </div>
    </div>
  )
}
