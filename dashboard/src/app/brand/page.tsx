import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import { Badge, BrandStatusBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { AlertCircle, CheckCircle2, Users, Package, ScanLine, Star, Calendar, Clock } from 'lucide-react'

export default async function BrandHomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: brandMember } = await supabase
    .from('brand_members')
    .select('brand_id, brands(*)')
    .eq('user_id', user!.id)
    .eq('role', 'admin')
    .single()

  const brand = brandMember?.brands as unknown as Record<string, string> | null

  const brandId = brand?.id ?? ''

  // Fetch all data in parallel
  const [
    { data: exhibitionBrands },
    { count: totalLeads },
    { count: hotLeads },
    { count: productCount },
    { count: teamCount },
  ] = await Promise.all([
    supabase.from('exhibition_brands').select('*, exhibitions(*)').eq('brand_id', brandId).order('created_at', { ascending: false }),
    supabase.from('visitor_scans').select('*', { count: 'exact', head: true }).eq('brand_id', brandId),
    supabase.from('visitor_scans').select('*', { count: 'exact', head: true }).eq('brand_id', brandId).eq('lead_rating', 'hot'),
    supabase.from('products').select('*', { count: 'exact', head: true }).eq('brand_id', brandId),
    supabase.from('brand_members').select('*', { count: 'exact', head: true }).eq('brand_id', brandId).eq('status', 'approved'),
  ])

  const now = new Date().toISOString().split('T')[0]
  const active = (exhibitionBrands ?? []).filter(eb => {
    const ex = eb.exhibitions as Record<string, string> | null
    return ex && ex.start_date <= now && ex.end_date >= now
  })
  const upcoming = (exhibitionBrands ?? []).filter(eb => {
    const ex = eb.exhibitions as Record<string, string> | null
    return ex && ex.start_date > now
  })
  const past = (exhibitionBrands ?? []).filter(eb => {
    const ex = eb.exhibitions as Record<string, string> | null
    return ex && ex.end_date < now
  })

  // Pending actions
  const pendingActions: { message: string; href: string }[] = []
  if (brand?.gst_status === 'rejected') {
    pendingActions.push({ message: 'GST verification rejected — resubmit document', href: '/brand/onboarding/gst' })
  }
  const { count: pendingPeople } = await supabase
    .from('brand_members').select('id', { count: 'exact', head: true })
    .eq('brand_id', brandId).eq('status', 'pending')
  if ((pendingPeople ?? 0) > 0) {
    pendingActions.push({
      message: `${pendingPeople} team member request${(pendingPeople ?? 0) > 1 ? 's' : ''} waiting for approval`,
      href: '/brand/people',
    })
  }

  const metrics = [
    { label: 'Total Leads', value: totalLeads ?? 0, icon: ScanLine, sub: 'across all shows' },
    { label: 'Hot Leads', value: hotLeads ?? 0, icon: Star, sub: 'high intent visitors' },
    { label: 'Exhibitions', value: (exhibitionBrands ?? []).length, icon: Calendar, sub: `${active.length} active` },
    { label: 'Products', value: productCount ?? 0, icon: Package, sub: 'in catalogue' },
  ]

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[var(--text)]">{brand?.name ?? 'Your Brand'}</h1>
        <p className="text-sm text-[var(--text3)] mt-1">{brand?.category ?? ''}</p>
      </div>

      {/* Metrics grid — always visible */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {metrics.map(m => (
          <Card key={m.label} className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--text3)] font-medium uppercase tracking-wider">{m.label}</span>
              <m.icon size={13} className="text-[var(--text3)]" />
            </div>
            <div className="text-3xl font-bold text-[var(--text)] tabular-nums">{m.value.toLocaleString()}</div>
            <div className="text-xs text-[var(--text3)]">{m.sub}</div>
          </Card>
        ))}
      </div>

      {/* Active exhibition banner */}
      {active.map(eb => {
        const ex = eb.exhibitions as Record<string, string> | null
        if (!ex) return null
        return (
          <Card key={eb.id} className="mb-6 border-[var(--accent)] bg-gradient-to-r from-[var(--accent-dim)] to-transparent">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2 h-2 rounded-full bg-[var(--green)] animate-pulse" />
                  <span className="text-xs font-bold uppercase tracking-wider text-[var(--green)]">Live Now</span>
                </div>
                <h2 className="text-lg font-bold text-[var(--text)]">{ex.name}</h2>
                <p className="text-sm text-[var(--text2)] mt-1">{ex.venue} · {ex.city}</p>
              </div>
              <Link href={`/brand/exhibitions/${eb.exhibition_id}`}>
                <Button size="sm">View Dashboard →</Button>
              </Link>
            </div>
          </Card>
        )
      })}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 flex flex-col gap-6">

          {/* Pending actions */}
          {pendingActions.length > 0 && (
            <Card>
              <div className="flex items-center gap-2 mb-4">
                <AlertCircle size={16} className="text-[var(--amber)]" />
                <h2 className="font-bold text-sm text-[var(--text)]">Needs Attention</h2>
              </div>
              <div className="flex flex-col gap-2">
                {pendingActions.map(action => (
                  <Link
                    key={action.href}
                    href={action.href}
                    className="flex items-center gap-3 p-3 rounded-xl bg-[var(--surface2)] border border-[var(--border)] hover:border-[var(--accent)] transition-colors group"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--amber)] flex-shrink-0" />
                    <span className="text-sm text-[var(--text2)] group-hover:text-[var(--text)] flex-1">{action.message}</span>
                    <span className="text-[var(--text3)] group-hover:text-[var(--accent)]">→</span>
                  </Link>
                ))}
              </div>
            </Card>
          )}

          {/* Upcoming exhibitions */}
          {upcoming.length > 0 && (
            <Card>
              <div className="flex items-center gap-2 mb-4">
                <Clock size={16} className="text-[var(--accent)]" />
                <h2 className="font-bold text-sm text-[var(--text)]">Upcoming Exhibitions</h2>
              </div>
              <div className="flex flex-col gap-3">
                {upcoming.map(eb => {
                  const ex = eb.exhibitions as Record<string, string> | null
                  if (!ex) return null
                  return (
                    <div key={eb.id} className="flex items-center gap-4 p-4 rounded-xl bg-[var(--surface2)] border border-[var(--border)]">
                      <div className="flex-1">
                        <div className="font-semibold text-sm text-[var(--text)]">{ex.name}</div>
                        <div className="text-xs text-[var(--text3)] mt-1">
                          {new Date(ex.start_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                          {' – '}
                          {new Date(ex.end_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                          {' · '}{ex.city}
                        </div>
                        <div className="mt-2"><BrandStatusBadge status={eb.status} /></div>
                      </div>
                      {eb.status !== 'active' && (
                        <Link href={`/brand/onboarding/identity?exhibition=${eb.exhibition_id}`}>
                          <Button size="sm" variant="secondary">Complete Setup →</Button>
                        </Link>
                      )}
                    </div>
                  )
                })}
              </div>
            </Card>
          )}

          {/* Past exhibitions */}
          {past.length > 0 && (
            <Card>
              <h2 className="font-bold text-sm text-[var(--text)] mb-4">Past Exhibitions</h2>
              <div className="flex flex-col divide-y divide-[var(--border)]">
                {past.map(eb => {
                  const ex = eb.exhibitions as Record<string, string> | null
                  if (!ex) return null
                  return (
                    <div key={eb.id} className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
                      <div className="flex-1">
                        <div className="text-sm font-medium text-[var(--text)]">{ex.name}</div>
                        <div className="text-xs text-[var(--text3)] mt-0.5">
                          {new Date(ex.start_date).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })} · {ex.city}
                        </div>
                      </div>
                      <Link href={`/brand/exhibitions/${eb.exhibition_id}`} className="text-xs text-[var(--accent)] hover:underline">
                        View Report →
                      </Link>
                    </div>
                  )
                })}
              </div>
            </Card>
          )}

          {/* No exhibitions — small nudge only */}
          {(exhibitionBrands ?? []).length === 0 && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-sm text-[var(--text3)]">
              <Calendar size={14} className="flex-shrink-0" />
              <span>Not part of any exhibition yet — your metrics will appear here once you're added to a show.</span>
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-4">
          <Card>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-sm text-[var(--text)]">Brand Profile</h2>
              <Link href="/brand/profile" className="text-xs text-[var(--accent)] hover:underline">Edit →</Link>
            </div>
            {brand?.cover_image_url ? (
              <img src={brand.cover_image_url} alt={brand.name} className="w-full h-28 object-cover rounded-xl mb-3" />
            ) : (
              <Link href="/brand/profile">
                <div className="w-full h-28 rounded-xl bg-[var(--surface2)] border border-dashed border-[var(--border)] flex flex-col items-center justify-center mb-3 hover:border-[var(--accent)] transition-colors cursor-pointer">
                  <span className="text-[var(--text3)] text-xs">No cover image</span>
                  <span className="text-[var(--accent)] text-xs mt-1">Upload in Profile →</span>
                </div>
              </Link>
            )}
            <div className="font-bold text-sm text-[var(--text)]">{brand?.name}</div>
            <div className="text-xs text-[var(--text3)] mt-0.5">{brand?.category}</div>
            {brand?.tagline && (
              <div className="text-xs text-[var(--text2)] mt-2 italic">"{brand.tagline}"</div>
            )}
            {brand?.gst_status && (
              <div className="mt-3">
                <Badge
                  label={
                    brand.gst_status === 'approved' ? '✓ Verified'
                    : brand.gst_status === 'pending' ? 'Verification Pending'
                    : brand.gst_status === 'rejected' ? 'Verification Failed'
                    : 'Not Verified'
                  }
                  variant={
                    brand.gst_status === 'approved' ? 'green'
                    : brand.gst_status === 'rejected' ? 'red'
                    : 'amber'
                  }
                />
              </div>
            )}
          </Card>

          <Card>
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-bold text-sm text-[var(--text)]">Team</h2>
              <Link href="/brand/people" className="text-xs text-[var(--accent)] hover:underline">Manage →</Link>
            </div>
            <div className="flex items-center gap-2">
              <Users size={13} className="text-[var(--text3)]" />
              <span className="text-sm text-[var(--text2)]">{teamCount ?? 0} approved member{(teamCount ?? 0) !== 1 ? 's' : ''}</span>
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-bold text-sm text-[var(--text)]">Brand QR</h2>
              <Link href="/brand/qr" className="text-xs text-[var(--accent)] hover:underline">Download →</Link>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 size={13} className="text-[var(--green)]" />
              <span className="text-xs text-[var(--green)]">Active — ready to print</span>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
