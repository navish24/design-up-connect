import Link from 'next/link'

const STEPS = [
  { step: 1, label: 'Brand Identity',   href: '/brand/onboarding/identity' },
  { step: 2, label: 'Contact & Location', href: '/brand/onboarding/contact' },
  { step: 3, label: 'Catalogue',         href: '/brand/onboarding/catalogue' },
  { step: 4, label: 'Representatives',   href: '/brand/onboarding/representatives' },
  { step: 5, label: 'GST Verification',  href: '/brand/onboarding/gst' },
]

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--bg)]">
      {/* Top bar */}
      <div className="border-b border-[var(--border)] bg-[var(--surface)] px-8 py-4 flex items-center justify-between">
        <div className="text-base font-bold text-[var(--accent)]">DESIGNUP</div>
        <div className="text-sm text-[var(--text3)]">Brand Onboarding</div>
        <Link href="/brand" className="text-xs text-[var(--text3)] hover:text-[var(--text2)]">Save & Exit</Link>
      </div>

      {/* Step progress */}
      <div className="border-b border-[var(--border)] bg-[var(--surface)] px-8 py-4">
        <div className="max-w-3xl mx-auto flex items-center gap-2">
          {STEPS.map((s, i) => (
            <div key={s.step} className="flex items-center gap-2 flex-1">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-6 h-6 rounded-full border border-[var(--border)] bg-[var(--surface2)] flex items-center justify-center text-xs font-bold text-[var(--text3)] flex-shrink-0">
                  {s.step}
                </div>
                <span className="text-xs text-[var(--text3)] truncate hidden sm:block">{s.label}</span>
              </div>
              {i < STEPS.length - 1 && <div className="h-px flex-1 bg-[var(--border)]" />}
            </div>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-6 py-10">
        {children}
      </div>
    </div>
  )
}
