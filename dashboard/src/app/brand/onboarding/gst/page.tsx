'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { CheckCircle2, Clock, XCircle } from 'lucide-react'

export default function GSTPage() {
  const router = useRouter()
  const supabase = createClient()

  const [file, setFile] = useState<File | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [existingStatus, setExistingStatus] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadExisting() {
      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user
      if (!user) return
      const { data: brand } = await supabase
        .from('brands')
        .select('gst_status, gst_document_url')
        .eq('admin_user_id', user.id)
        .maybeSingle()
      if (!brand) return
      if (brand.gst_status && brand.gst_status !== 'not_submitted') {
        setExistingStatus(brand.gst_status)
        if (brand.gst_status === 'pending' || brand.gst_status === 'approved') {
          setSubmitted(true)
        }
      }
    }
    loadExisting()
  }, [])

  async function submit() {
    if (!file) { setError('Please upload your GST certificate'); return }
    setLoading(true)
    setError('')
    try {
      let docUrl: string | null = null

      // Try Cloudinary upload; skip gracefully if not configured
      try {
        const res = await fetch('/api/upload-signed-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ folder: 'gst-documents', resource_type: 'raw' }),
        })
        const { signature, timestamp, apiKey, cloudName, folder } = await res.json()
        if (cloudName && cloudName !== 'your_cloudinary_cloud_name') {
          const fd = new FormData()
          fd.append('file', file)
          fd.append('signature', signature)
          fd.append('timestamp', String(timestamp))
          fd.append('api_key', apiKey)
          fd.append('folder', folder)
          const up = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/raw/upload`, { method: 'POST', body: fd })
          const result = await up.json()
          docUrl = result.secure_url ?? null
        }
      } catch {
        // Cloudinary not configured — proceed without file URL
      }

      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user
      const { error: err } = await supabase
        .from('brands')
        .update({
          ...(docUrl ? { gst_document_url: docUrl } : { gst_document_url: file.name }),
          gst_status: 'pending',
          onboarding_step: 'complete',
        })
        .eq('admin_user_id', user!.id)

      if (err) throw err
      setSubmitted(true)
    } catch (e: unknown) {
      const msg = (e as { message?: string })?.message ?? 'Submission failed'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div className="flex flex-col gap-6">
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-10 flex flex-col items-center text-center gap-4">
          <Clock size={48} className="text-[var(--accent)]" />
          <h1 className="text-xl font-bold text-[var(--text)]">Verification Submitted</h1>
          <p className="text-sm text-[var(--text2)] max-w-sm">
            Verification typically takes 1–2 business days. You will be notified once approved.
            Your brand QR will be generated automatically when approved.
          </p>
          <div className="flex flex-col gap-2 w-full max-w-xs mt-2">
            <div className="flex items-center gap-2 p-3 rounded-xl bg-[var(--green-dim)] border border-[var(--green)]">
              <CheckCircle2 size={16} className="text-[var(--green)]" />
              <span className="text-sm text-[var(--green)]">All 5 steps completed</span>
            </div>
            <div className="flex items-center gap-2 p-3 rounded-xl bg-[var(--amber)]/10 border border-[var(--amber)]">
              <Clock size={16} className="text-[var(--amber)]" />
              <span className="text-sm text-[var(--amber)]">GST verification pending</span>
            </div>
          </div>
          <Button onClick={() => router.push('/brand')} className="mt-4">
            Go to Dashboard
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="text-xs font-bold uppercase tracking-wider text-[var(--accent)] mb-1">Step 5 of 5</div>
        <h1 className="text-xl font-bold text-[var(--text)]">GST Verification</h1>
        <p className="text-sm text-[var(--text3)] mt-1">
          Upload your GST certificate. Designup will verify it within 1–2 business days.
          Your brand QR will be generated automatically on approval.
        </p>
      </div>

      {/* Why we need this */}
      <div className="bg-[var(--accent-dim)] border border-[var(--accent)] rounded-xl px-4 py-3">
        <p className="text-xs text-[var(--text2)] leading-relaxed">
          <strong className="text-[var(--accent)]">Why is this required?</strong>{' '}
          GST verification ensures only legitimate, registered businesses participate on Designup, protecting the trust of designers and architects who use the platform.
        </p>
      </div>

      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold uppercase tracking-wider text-[var(--text3)]">
            GST Certificate
          </label>
          {file ? (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-[var(--surface2)] border border-[var(--border)]">
              <CheckCircle2 size={16} className="text-[var(--green)] flex-shrink-0" />
              <span className="text-sm text-[var(--text2)] flex-1 truncate">{file.name}</span>
              <button onClick={() => setFile(null)} className="text-xs text-[var(--text3)] hover:text-[var(--red)]">
                <XCircle size={16} />
              </button>
            </div>
          ) : (
            <label className="border border-dashed border-[var(--border)] rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer hover:border-[var(--accent)] transition-colors">
              <span className="text-2xl mb-2">📄</span>
              <span className="text-sm text-[var(--text2)]">Click to upload GST certificate</span>
              <span className="text-xs text-[var(--text3)] mt-1">PDF, JPG, or PNG</span>
              <input type="file" accept=".pdf,image/*" className="hidden" onChange={e => setFile(e.target.files?.[0] ?? null)} />
            </label>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-[var(--red-dim)] border border-[var(--red)] rounded-xl px-4 py-3 text-sm text-[var(--red)]">
          {error}
        </div>
      )}

      <div className="flex justify-between">
        <Button variant="ghost" onClick={() => router.push('/brand/onboarding/representatives')}>← Back</Button>
        <Button onClick={submit} loading={loading} disabled={!file} size="lg">
          Submit for Verification
        </Button>
      </div>
    </div>
  )
}
