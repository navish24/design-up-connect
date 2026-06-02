'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { CheckCircle2, XCircle, Clock, ExternalLink, FileText, RefreshCw } from 'lucide-react'

interface BrandRow {
  id: string
  name: string
  category: string | null
  contact_name: string | null
  contact_email: string | null
  contact_phone: string | null
  gst_status: string
  gst_document_url: string | null
  qr_token: string | null
  onboarding_step: string | null
  created_at: string
  admin_user_id: string | null
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending:       { label: 'Pending Review', color: 'text-[var(--amber)]',  icon: <Clock size={13} /> },
  approved:      { label: 'Approved',       color: 'text-[var(--green)]',  icon: <CheckCircle2 size={13} /> },
  rejected:      { label: 'Rejected',       color: 'text-[var(--red)]',    icon: <XCircle size={13} /> },
  not_submitted: { label: 'Not Submitted',  color: 'text-[var(--text3)]',  icon: <FileText size={13} /> },
}

export default function AdminPage() {
  const supabase = createClient()
  const [brands, setBrands] = useState<BrandRow[]>([])
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('brands')
      .select('id, name, category, contact_name, contact_email, contact_phone, gst_status, gst_document_url, qr_token, onboarding_step, created_at, admin_user_id')
      .order('created_at', { ascending: false })
    setBrands((data as BrandRow[]) ?? [])
    setLoading(false)
  }

  async function approve(brand: BrandRow) {
    setActing(brand.id)
    const qr_token = brand.qr_token ?? crypto.randomUUID()
    await supabase
      .from('brands')
      .update({ gst_status: 'approved', qr_token })
      .eq('id', brand.id)
    setBrands(prev => prev.map(b => b.id === brand.id ? { ...b, gst_status: 'approved', qr_token } : b))
    setActing(null)
  }

  async function reject(brand: BrandRow) {
    setActing(brand.id)
    await supabase
      .from('brands')
      .update({ gst_status: 'rejected' })
      .eq('id', brand.id)
    setBrands(prev => prev.map(b => b.id === brand.id ? { ...b, gst_status: 'rejected' } : b))
    setActing(null)
  }

  async function resetToPending(brand: BrandRow) {
    setActing(brand.id)
    await supabase
      .from('brands')
      .update({ gst_status: 'pending' })
      .eq('id', brand.id)
    setBrands(prev => prev.map(b => b.id === brand.id ? { ...b, gst_status: 'pending' } : b))
    setActing(null)
  }

  const filtered = brands.filter(b => filter === 'all' || b.gst_status === filter)
  const counts = {
    all:      brands.length,
    pending:  brands.filter(b => b.gst_status === 'pending').length,
    approved: brands.filter(b => b.gst_status === 'approved').length,
    rejected: brands.filter(b => b.gst_status === 'rejected').length,
  }

  return (
    <>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text)]">Brand Approvals</h1>
          <p className="text-sm text-[var(--text3)] mt-1">Review GST submissions and approve brands</p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-1.5 text-xs text-[var(--text3)] hover:text-[var(--accent)] transition-colors"
        >
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-6 bg-[var(--surface)] border border-[var(--border)] rounded-xl p-1 w-fit">
        {(['pending', 'all', 'approved', 'rejected'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={[
              'px-4 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5',
              filter === f
                ? 'bg-[var(--accent)] text-black'
                : 'text-[var(--text3)] hover:text-[var(--text2)]',
            ].join(' ')}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
            <span className={[
              'px-1.5 py-0.5 rounded-full text-xs',
              filter === f ? 'bg-black/20' : 'bg-[var(--surface2)]',
            ].join(' ')}>
              {counts[f]}
            </span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-sm text-[var(--text3)] py-12 text-center">Loading brands…</div>
      ) : filtered.length === 0 ? (
        <div className="text-sm text-[var(--text3)] py-16 text-center border border-dashed border-[var(--border)] rounded-2xl">
          {filter === 'pending' ? 'No pending submissions — you\'re all caught up.' : `No ${filter} brands.`}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {filtered.map(brand => {
            const status = STATUS_CONFIG[brand.gst_status] ?? STATUS_CONFIG.not_submitted
            const isPending = brand.gst_status === 'pending'
            const isApproved = brand.gst_status === 'approved'
            const isRejected = brand.gst_status === 'rejected'
            const isLoading = acting === brand.id

            return (
              <div
                key={brand.id}
                className={[
                  'bg-[var(--surface)] border rounded-2xl p-6',
                  isPending ? 'border-[var(--amber)]' : 'border-[var(--border)]',
                ].join(' ')}
              >
                <div className="flex items-start justify-between gap-4">
                  {/* Brand info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h2 className="font-bold text-[var(--text)]">{brand.name}</h2>
                      {brand.category && (
                        <span className="text-xs text-[var(--text3)] bg-[var(--surface2)] border border-[var(--border)] px-2 py-0.5 rounded-full">
                          {brand.category}
                        </span>
                      )}
                      <Link
                        href={`/admin/brands/${brand.id}`}
                        className="text-xs text-[var(--accent)] hover:underline ml-1"
                      >
                        View Details →
                      </Link>
                    </div>

                    <div className="flex items-center gap-1.5 mb-4">
                      <span className={['flex items-center gap-1 text-xs font-medium', status.color].join(' ')}>
                        {status.icon} {status.label}
                      </span>
                      <span className="text-[var(--text3)] text-xs">·</span>
                      <span className="text-xs text-[var(--text3)]">
                        Submitted {new Date(brand.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <div className="text-xs text-[var(--text3)] uppercase tracking-wider font-semibold mb-0.5">Contact</div>
                        <div className="text-[var(--text2)]">{brand.contact_name ?? '—'}</div>
                      </div>
                      <div>
                        <div className="text-xs text-[var(--text3)] uppercase tracking-wider font-semibold mb-0.5">Email</div>
                        <div className="text-[var(--text2)] truncate">{brand.contact_email ?? '—'}</div>
                      </div>
                      <div>
                        <div className="text-xs text-[var(--text3)] uppercase tracking-wider font-semibold mb-0.5">Phone</div>
                        <div className="text-[var(--text2)]">{brand.contact_phone ?? '—'}</div>
                      </div>
                    </div>

                    {/* GST document */}
                    {brand.gst_document_url && (
                      <div className="mt-4 flex items-center gap-2">
                        <FileText size={13} className="text-[var(--text3)] flex-shrink-0" />
                        {brand.gst_document_url.startsWith('http') ? (
                          <a
                            href={brand.gst_document_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-[var(--accent)] hover:underline flex items-center gap-1"
                          >
                            View GST Document <ExternalLink size={11} />
                          </a>
                        ) : (
                          <span className="text-xs text-[var(--text3)]">
                            {brand.gst_document_url} <span className="italic">(file not uploaded — Cloudinary not configured)</span>
                          </span>
                        )}
                      </div>
                    )}

                    {isApproved && brand.qr_token && (
                      <div className="mt-3 flex items-center gap-2 text-xs text-[var(--green)]">
                        <CheckCircle2 size={12} />
                        QR token active: <code className="font-mono text-[var(--text3)]">{brand.qr_token.slice(0, 16)}…</code>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-2 flex-shrink-0">
                    {isPending && (
                      <>
                        <Button
                          size="sm"
                          onClick={() => approve(brand)}
                          loading={isLoading}
                        >
                          <CheckCircle2 size={13} /> Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => reject(brand)}
                          loading={isLoading}
                        >
                          <XCircle size={13} /> Reject
                        </Button>
                      </>
                    )}
                    {isApproved && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => reject(brand)}
                        loading={isLoading}
                      >
                        <XCircle size={13} /> Revoke
                      </Button>
                    )}
                    {isRejected && (
                      <Button
                        size="sm"
                        onClick={() => approve(brand)}
                        loading={isLoading}
                      >
                        <CheckCircle2 size={13} /> Approve
                      </Button>
                    )}
                    {(isApproved || isRejected) && (
                      <button
                        onClick={() => resetToPending(brand)}
                        disabled={isLoading}
                        className="text-xs text-[var(--text3)] hover:text-[var(--text2)] transition-colors disabled:opacity-40"
                      >
                        Reset to pending
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}
