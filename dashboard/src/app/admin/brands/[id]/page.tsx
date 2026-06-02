import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CheckCircle2, XCircle, Clock, FileText, ExternalLink, ArrowLeft } from 'lucide-react'

const STATUS_ICON: Record<string, React.ReactNode> = {
  approved:      <CheckCircle2 size={14} className="text-[var(--green)]" />,
  rejected:      <XCircle size={14} className="text-[var(--red)]" />,
  pending:       <Clock size={14} className="text-[var(--amber)]" />,
  not_submitted: <FileText size={14} className="text-[var(--text3)]" />,
}

const STATUS_LABEL: Record<string, string> = {
  approved: 'Approved', rejected: 'Rejected', pending: 'Pending Review', not_submitted: 'Not Submitted',
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6">
      <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text3)] mb-4">{title}</h2>
      {children}
    </div>
  )
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <div className="text-xs text-[var(--text3)] font-semibold uppercase tracking-wider mb-0.5">{label}</div>
      <div className="text-sm text-[var(--text2)]">{value || <span className="italic text-[var(--text3)]">Not provided</span>}</div>
    </div>
  )
}

export default async function AdminBrandDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: brand }, { data: products }] = await Promise.all([
    supabase
      .from('brands')
      .select('*')
      .eq('id', id)
      .single(),
    supabase
      .from('products')
      .select('*, images:product_images(*)')
      .eq('brand_id', id)
      .order('display_order'),
  ])

  if (!brand) notFound()

  const b = brand as Record<string, string | null>

  return (
    <>
      <div className="mb-8">
        <Link
          href="/admin"
          className="flex items-center gap-1.5 text-xs text-[var(--text3)] hover:text-[var(--accent)] transition-colors mb-4"
        >
          <ArrowLeft size={13} /> Back to Approvals
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[var(--text)]">{b.name}</h1>
            <p className="text-sm text-[var(--text3)] mt-0.5">{b.category}</p>
          </div>
          <div className={[
            'flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-full border',
            b.gst_status === 'approved' ? 'text-[var(--green)] border-[var(--green)] bg-[var(--green-dim)]'
              : b.gst_status === 'pending' ? 'text-[var(--amber)] border-[var(--amber)] bg-[var(--amber)]/10'
              : b.gst_status === 'rejected' ? 'text-[var(--red)] border-[var(--red)] bg-[var(--red-dim)]'
              : 'text-[var(--text3)] border-[var(--border)]',
          ].join(' ')}>
            {STATUS_ICON[b.gst_status ?? 'not_submitted']}
            {STATUS_LABEL[b.gst_status ?? 'not_submitted']}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        {/* Cover image */}
        {b.cover_image_url && (
          <div className="rounded-2xl overflow-hidden border border-[var(--border)] h-48">
            <img src={b.cover_image_url} alt={b.name ?? ''} className="w-full h-full object-cover" />
          </div>
        )}

        {/* Brand Identity */}
        <Section title="Brand Identity">
          <div className="grid grid-cols-2 gap-5">
            <Field label="Brand Name" value={b.name} />
            <Field label="Category" value={b.category} />
            <Field label="Tagline" value={b.tagline} />
            <Field label="Onboarding Step" value={b.onboarding_step} />
          </div>
          {b.about && (
            <div className="mt-5">
              <div className="text-xs text-[var(--text3)] font-semibold uppercase tracking-wider mb-1">About</div>
              <p className="text-sm text-[var(--text2)] leading-relaxed">{b.about}</p>
            </div>
          )}
          {b.design_philosophy && (
            <div className="mt-4">
              <div className="text-xs text-[var(--text3)] font-semibold uppercase tracking-wider mb-1">Design Philosophy</div>
              <p className="text-sm text-[var(--text2)] leading-relaxed">{b.design_philosophy}</p>
            </div>
          )}
        </Section>

        {/* Contact & Location */}
        <Section title="Contact & Location">
          <div className="grid grid-cols-3 gap-5">
            <Field label="Contact Name" value={b.contact_name} />
            <Field label="Email" value={b.contact_email} />
            <Field label="Phone" value={b.contact_phone} />
            <Field label="City" value={b.city} />
            <Field label="Service Location" value={b.service_location} />
            <Field label="Website" value={b.website} />
          </div>
        </Section>

        {/* GST Verification */}
        <Section title="GST Verification">
          <div className="grid grid-cols-2 gap-5">
            <div>
              <div className="text-xs text-[var(--text3)] font-semibold uppercase tracking-wider mb-1">Status</div>
              <div className={[
                'flex items-center gap-1.5 text-sm font-medium',
                b.gst_status === 'approved' ? 'text-[var(--green)]'
                  : b.gst_status === 'pending' ? 'text-[var(--amber)]'
                  : b.gst_status === 'rejected' ? 'text-[var(--red)]'
                  : 'text-[var(--text3)]',
              ].join(' ')}>
                {STATUS_ICON[b.gst_status ?? 'not_submitted']}
                {STATUS_LABEL[b.gst_status ?? 'not_submitted']}
              </div>
            </div>
            <div>
              <div className="text-xs text-[var(--text3)] font-semibold uppercase tracking-wider mb-1">Document</div>
              {b.gst_document_url ? (
                b.gst_document_url.startsWith('http') ? (
                  <a
                    href={b.gst_document_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-sm text-[var(--accent)] hover:underline"
                  >
                    View Document <ExternalLink size={12} />
                  </a>
                ) : (
                  <span className="text-sm text-[var(--text2)]">
                    {b.gst_document_url}
                    <span className="ml-1 text-xs text-[var(--text3)] italic">(not uploaded)</span>
                  </span>
                )
              ) : (
                <span className="text-sm italic text-[var(--text3)]">No document uploaded</span>
              )}
            </div>
          </div>
          {b.qr_token && (
            <div className="mt-4 pt-4 border-t border-[var(--border)]">
              <div className="text-xs text-[var(--text3)] font-semibold uppercase tracking-wider mb-1">QR Token</div>
              <code className="text-xs font-mono text-[var(--accent)]">{b.qr_token}</code>
            </div>
          )}
        </Section>

        {/* Catalogue */}
        <Section title={`Catalogue (${products?.length ?? 0} products)`}>
          {!products || products.length === 0 ? (
            <p className="text-sm italic text-[var(--text3)]">No products added yet</p>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {(products as Record<string, unknown>[]).map(p => {
                const images = p.images as { url: string }[] | null
                return (
                  <div key={p.id as string} className="border border-[var(--border)] rounded-xl overflow-hidden">
                    {images?.[0]?.url ? (
                      <img src={images[0].url} alt={p.name as string} className="w-full h-32 object-cover" />
                    ) : (
                      <div className="w-full h-32 bg-[var(--surface2)] flex items-center justify-center">
                        <span className="text-xs text-[var(--text3)]">No image</span>
                      </div>
                    )}
                    <div className="p-3">
                      <div className="font-semibold text-sm text-[var(--text)]">{p.name as string}</div>
                      <div className="text-xs text-[var(--text3)] mt-0.5">
                        {[p.material as string, p.colour as string].filter(Boolean).join(' · ') || '—'}
                      </div>
                      {Boolean(p.dimensions) && (
                        <div className="text-xs text-[var(--text3)]">{String(p.dimensions)}</div>
                      )}
                      {Boolean(p.customisation_details) && (
                        <div className="text-xs text-[var(--text2)] mt-1 line-clamp-2">{String(p.customisation_details)}</div>
                      )}
                      {images && images.length > 1 && (
                        <div className="text-xs text-[var(--text3)] mt-1">{images.length} images</div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Section>
      </div>
    </>
  )
}
