'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'

export default function NewExhibitionPage() {
  const router = useRouter()
  const supabase = createClient()

  const [form, setForm] = useState({
    name: '', venue: '', city: '', start_date: '', end_date: '', description: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function create() {
    if (!form.name || !form.venue || !form.city || !form.start_date || !form.end_date) {
      setError('All fields except description are required')
      return
    }
    if (form.end_date < form.start_date) {
      setError('End date must be after start date')
      return
    }
    setLoading(true)
    setError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user
      const { data, error: err } = await supabase
        .from('exhibitions')
        .insert({ ...form, organiser_id: user!.id, state: 'upcoming' })
        .select()
        .single()
      if (err) throw err
      router.push(`/organiser/exhibitions/${data.id}`)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create exhibition')
      setLoading(false)
    }
  }

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[var(--text)]">Create Exhibition</h1>
        <p className="text-sm text-[var(--text3)] mt-1">Set up a new exhibition for brands to register in.</p>
      </div>

      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 flex flex-col gap-5">
        <Input label="Exhibition Name" value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Design Democracy 2026" />
        <div className="grid grid-cols-2 gap-4">
          <Input label="Venue" value={form.venue} onChange={e => set('venue', e.target.value)} placeholder="e.g. NSCI Dome" />
          <Input label="City" value={form.city} onChange={e => set('city', e.target.value)} placeholder="e.g. Mumbai" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Start Date" type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} />
          <Input label="End Date" type="date" value={form.end_date} onChange={e => set('end_date', e.target.value)} />
        </div>
        <Textarea label="Description (optional)" value={form.description} onChange={e => set('description', e.target.value)} placeholder="Brief description for brands and visitors..." rows={3} />
      </div>

      {error && (
        <div className="mt-4 bg-[var(--red-dim)] border border-[var(--red)] rounded-xl px-4 py-3 text-sm text-[var(--red)]">
          {error}
        </div>
      )}

      <div className="flex justify-between mt-6">
        <Button variant="ghost" onClick={() => router.push('/organiser/exhibitions')}>← Cancel</Button>
        <Button onClick={create} loading={loading} size="lg">Create Exhibition →</Button>
      </div>
    </div>
  )
}
