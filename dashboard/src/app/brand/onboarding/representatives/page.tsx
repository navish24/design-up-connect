'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { UserCheck, UserX } from 'lucide-react'

interface LinkedUser {
  id: string
  user_id: string
  status: string
  user: {
    full_name: string
    designation: string | null
  }
}

export default function RepresentativesPage() {
  const router = useRouter()
  const supabase = createClient()
  const [linkedUsers, setLinkedUsers] = useState<LinkedUser[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user
      const { data: brand } = await supabase.from('brands').select('id').eq('admin_user_id', user!.id).single()
      if (!brand) return

      const { data } = await supabase
        .from('brand_members')
        .select('id, user_id, status, user:users(full_name, designation)')
        .eq('brand_id', brand.id)
        .neq('role', 'admin')
      setLinkedUsers((data as unknown as LinkedUser[]) ?? [])
      setLoading(false)
    }
    load()
  }, [])

  async function approve(memberId: string) {
    await supabase.from('brand_members').update({ status: 'approved' }).eq('id', memberId)
    setLinkedUsers(prev => prev.map(u => u.id === memberId ? { ...u, status: 'approved' } : u))
  }

  async function decline(memberId: string) {
    await supabase.from('brand_members').update({ status: 'declined' }).eq('id', memberId)
    setLinkedUsers(prev => prev.map(u => u.id === memberId ? { ...u, status: 'declined' } : u))
  }

  async function proceed() {
    setSubmitting(true)
    const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user
    await supabase.from('brands').update({ onboarding_step: 'gst' }).eq('admin_user_id', user!.id)
    router.push('/brand/onboarding/gst')
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="text-xs font-bold uppercase tracking-wider text-[var(--accent)] mb-1">Step 4 of 5</div>
        <h1 className="text-xl font-bold text-[var(--text)]">Representatives</h1>
        <p className="text-sm text-[var(--text3)] mt-1">
          This step is optional — you can complete onboarding without adding any representatives. Approve users who have requested to link their Designup profile to your brand.
        </p>
      </div>

      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6">
        {loading ? (
          <p className="text-sm text-[var(--text3)] text-center py-6">Loading...</p>
        ) : linkedUsers.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-[var(--text2)]">No pending requests</p>
            <p className="text-xs text-[var(--text3)] mt-1">
              Team members can request to link their profile via the Designup app.
            </p>
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-[var(--border)]">
            {linkedUsers.map(u => (
              <div key={u.id} className="flex items-center gap-4 py-4 first:pt-0 last:pb-0">
                <div className="w-10 h-10 rounded-full bg-[var(--accent-dim)] border border-[var(--accent)] flex items-center justify-center text-[var(--accent)] font-bold text-sm flex-shrink-0">
                  {u.user?.full_name?.charAt(0) ?? '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-[var(--text)]">{u.user?.full_name}</div>
                  {u.user?.designation && (
                    <div className="text-xs text-[var(--text3)]">{u.user.designation}</div>
                  )}
                </div>
                {u.status === 'pending' ? (
                  <div className="flex gap-2">
                    <button
                      onClick={() => approve(u.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--green-dim)] text-[var(--green)] border border-[var(--green)] text-xs font-semibold hover:opacity-80 transition-opacity"
                    >
                      <UserCheck size={13} /> Approve
                    </button>
                    <button
                      onClick={() => decline(u.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--red-dim)] text-[var(--red)] border border-[var(--red)] text-xs font-semibold hover:opacity-80 transition-opacity"
                    >
                      <UserX size={13} /> Decline
                    </button>
                  </div>
                ) : (
                  <span className={`text-xs font-semibold ${u.status === 'approved' ? 'text-[var(--green)]' : 'text-[var(--text3)]'}`}>
                    {u.status.charAt(0).toUpperCase() + u.status.slice(1)}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex justify-between">
        <Button variant="ghost" onClick={() => router.push('/brand/onboarding/catalogue')}>← Back</Button>
        <Button onClick={proceed} loading={submitting} size="lg">
          Continue to GST Verification →
        </Button>
      </div>
    </div>
  )
}
