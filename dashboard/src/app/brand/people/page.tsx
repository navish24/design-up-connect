'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { Check, X, Star, StarOff, UserPlus } from 'lucide-react'

interface Member {
  id: string
  user_id: string
  role: string
  status: string
  show_on_about: boolean
  users: { full_name: string | null; phone: string | null; email: string | null } | null
}

export default function PeoplePage() {
  const supabase = createClient()
  const [members, setMembers] = useState<Member[]>([])
  const [brandId, setBrandId] = useState('')
  const [loading, setLoading] = useState(true)

  // Add member form
  const [showAdd, setShowAdd] = useState(false)
  const [addInput, setAddInput] = useState('')
  const [addLoading, setAddLoading] = useState(false)
  const [addError, setAddError] = useState('')
  const [addSuccess, setAddSuccess] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
    if (!user) return
    const { data: adminMember } = await supabase
      .from('brand_members')
      .select('brand_id')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single()
    if (!adminMember) return
    setBrandId(adminMember.brand_id)

    const { data } = await supabase
      .from('brand_members')
      .select('*, users(full_name, phone, email)')
      .eq('brand_id', adminMember.brand_id)
      .neq('role', 'admin')
      .order('created_at')

    setMembers((data as Member[]) ?? [])
    setLoading(false)
  }

  async function addMember() {
    if (!addInput.trim()) { setAddError('Enter an email or phone number'); return }
    setAddLoading(true); setAddError(''); setAddSuccess('')
    try {
      const query = addInput.includes('@')
        ? supabase.from('users').select('id, full_name, email, phone').eq('email', addInput.trim()).maybeSingle()
        : supabase.from('users').select('id, full_name, email, phone').eq('phone', addInput.trim()).maybeSingle()
      const { data: found } = await query
      if (!found) {
        setAddError('No Designup user found with that email or phone. Ask them to sign in to Designup first.')
        return
      }
      // Check if already a member
      const { data: existing } = await supabase
        .from('brand_members')
        .select('id, status')
        .eq('brand_id', brandId)
        .eq('user_id', found.id)
        .maybeSingle()
      if (existing) {
        setAddError(`This person is already ${existing.status === 'declined' ? 'declined — use Re-approve' : 'a member of this brand'}.`)
        return
      }
      const { error } = await supabase.from('brand_members').insert({
        id: crypto.randomUUID(),
        brand_id: brandId,
        user_id: found.id,
        role: 'rep',
        status: 'approved',
        show_on_about: false,
      })
      if (error) throw error
      setAddSuccess(`${found.full_name ?? found.email ?? found.phone} added as a representative.`)
      setAddInput('')
      await load()
    } catch (e: unknown) {
      setAddError((e as { message?: string })?.message ?? 'Failed to add member')
    } finally { setAddLoading(false) }
  }

  async function approve(memberId: string) {
    await supabase.from('brand_members').update({ status: 'approved' }).eq('id', memberId)
    setMembers(m => m.map(mb => mb.id === memberId ? { ...mb, status: 'approved' } : mb))
  }

  async function decline(memberId: string) {
    await supabase.from('brand_members').update({ status: 'declined' }).eq('id', memberId)
    setMembers(m => m.map(mb => mb.id === memberId ? { ...mb, status: 'declined' } : mb))
  }

  async function toggleAbout(member: Member) {
    const approved = members.filter(m => m.status === 'approved')
    const onAbout = approved.filter(m => m.show_on_about)
    if (!member.show_on_about && onAbout.length >= 3) return
    const val = !member.show_on_about
    await supabase.from('brand_members').update({ show_on_about: val }).eq('id', member.id)
    setMembers(m => m.map(mb => mb.id === member.id ? { ...mb, show_on_about: val } : mb))
  }

  const pending = members.filter(m => m.status === 'pending')
  const approved = members.filter(m => m.status === 'approved')
  const declined = members.filter(m => m.status === 'declined')
  const onAboutCount = approved.filter(m => m.show_on_about).length

  function nameOf(m: Member) {
    return m.users?.full_name ?? m.users?.email ?? m.users?.phone ?? 'Unknown'
  }

  if (loading) return <div className="p-8 text-sm text-[var(--text3)]">Loading…</div>

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-xl font-bold text-[var(--text)]">People at Brand</h1>
          <p className="text-sm text-[var(--text3)] mt-0.5">Manage your team access and who shows on your About page</p>
        </div>
        <Button size="sm" onClick={() => { setShowAdd(v => !v); setAddError(''); setAddSuccess('') }}>
          <UserPlus size={14} /> Add Person
        </Button>
      </div>

      {/* Add member form */}
      {showAdd && (
        <div className="bg-[var(--surface)] border border-[var(--accent)] rounded-2xl p-5 mb-8 flex flex-col gap-4">
          <h3 className="text-sm font-bold text-[var(--text)]">Add a Representative</h3>
          <p className="text-xs text-[var(--text3)] -mt-2">
            Enter the email or phone number they used to sign in to Designup. They must have signed in at least once.
          </p>
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                label=""
                value={addInput}
                onChange={e => { setAddInput(e.target.value); setAddError(''); setAddSuccess('') }}
                placeholder="Email or phone (e.g. +91...)"
                onKeyDown={e => { if (e.key === 'Enter') addMember() }}
              />
            </div>
            <div className="pt-0.5">
              <Button size="sm" loading={addLoading} onClick={addMember}>Add</Button>
            </div>
          </div>
          {addError && <p className="text-xs text-[var(--red)] font-medium">{addError}</p>}
          {addSuccess && <p className="text-xs text-[var(--green)] font-medium">{addSuccess}</p>}
        </div>
      )}

      {/* Pending approvals */}
      {pending.length > 0 && (
        <section className="mb-8">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text3)] mb-3">
            Pending Requests ({pending.length})
          </h2>
          <div className="flex flex-col gap-3">
            {pending.map(m => (
              <Card key={m.id} className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-[var(--text)]">{nameOf(m)}</div>
                  <div className="text-xs text-[var(--text3)] mt-0.5">{m.users?.email ?? m.users?.phone}</div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <Button variant="secondary" size="sm" onClick={() => decline(m.id)}>
                    <X size={13} /> Decline
                  </Button>
                  <Button size="sm" onClick={() => approve(m.id)}>
                    <Check size={13} /> Approve
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Approved team */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text3)]">
            Team ({approved.length})
          </h2>
          <span className="text-xs text-[var(--text3)]">{onAboutCount}/3 shown on About</span>
        </div>
        {approved.length === 0 ? (
          <div className="text-sm text-[var(--text3)] text-center py-8 border border-dashed border-[var(--border)] rounded-xl">
            No team members yet — use "Add Person" to add representatives
          </div>
        ) : (
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  {['Name', 'Contact', 'About Page', ''].map(h => (
                    <th key={h} className="text-left text-xs font-bold uppercase tracking-wider text-[var(--text3)] px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {approved.map(m => (
                  <tr key={m.id} className="hover:bg-[var(--surface2)] transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-[var(--text)]">{nameOf(m)}</td>
                    <td className="px-4 py-3 text-xs text-[var(--text3)]">{m.users?.email ?? m.users?.phone}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleAbout(m)}
                        disabled={!m.show_on_about && onAboutCount >= 3}
                        className={[
                          'flex items-center gap-1.5 text-xs transition-colors',
                          m.show_on_about ? 'text-[var(--accent)]' : 'text-[var(--text3)] hover:text-[var(--text2)]',
                          !m.show_on_about && onAboutCount >= 3 ? 'opacity-40 cursor-not-allowed' : '',
                        ].join(' ')}
                      >
                        {m.show_on_about ? <Star size={13} fill="currentColor" /> : <StarOff size={13} />}
                        {m.show_on_about ? 'Featured' : 'Add'}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => decline(m.id)}
                        className="text-xs text-[var(--text3)] hover:text-[var(--red)] transition-colors"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Declined */}
      {declined.length > 0 && (
        <section>
          <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text3)] mb-3">
            Declined ({declined.length})
          </h2>
          <div className="flex flex-col gap-2">
            {declined.map(m => (
              <div key={m.id} className="flex items-center justify-between px-4 py-3 bg-[var(--surface)] border border-[var(--border)] rounded-xl">
                <div>
                  <div className="text-sm text-[var(--text3)]">{nameOf(m)}</div>
                  <div className="text-xs text-[var(--text3)]">{m.users?.email ?? m.users?.phone}</div>
                </div>
                <button onClick={() => approve(m.id)} className="text-xs text-[var(--text3)] hover:text-[var(--accent)] transition-colors">Re-approve</button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
