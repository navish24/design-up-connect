type BadgeVariant = 'accent' | 'green' | 'red' | 'amber' | 'neutral'

const variantStyles: Record<BadgeVariant, string> = {
  accent:  'bg-[var(--accent-dim)] text-[var(--accent)] border-[var(--accent)]',
  green:   'bg-[var(--green-dim)] text-[var(--green)] border-[var(--green)]',
  red:     'bg-[var(--red-dim)] text-[var(--red)] border-[var(--red)]',
  amber:   'bg-[var(--amber-dim)] text-[var(--amber)] border-[var(--amber)]',
  neutral: 'bg-[var(--surface3)] text-[var(--text2)] border-transparent',
}

export function Badge({ label, variant = 'neutral' }: { label: string; variant?: BadgeVariant }) {
  return (
    <span
      className={[
        'inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold border',
        variantStyles[variant],
      ].join(' ')}
    >
      {label}
    </span>
  )
}

export function BrandStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: BadgeVariant }> = {
    invited:                { label: 'Invited',                variant: 'neutral' },
    awaiting_setup:         { label: 'Awaiting Setup',         variant: 'neutral' },
    setup_in_progress:      { label: 'Setup In Progress',      variant: 'amber' },
    onboarding_in_progress: { label: 'Onboarding In Progress', variant: 'amber' },
    verification_in_progress:{ label: 'Verification In Progress', variant: 'amber' },
    active:                 { label: 'Active',                 variant: 'green' },
    failed:                 { label: 'Failed',                 variant: 'red' },
  }
  const { label, variant } = map[status] ?? { label: status, variant: 'neutral' }
  return <Badge label={label} variant={variant} />
}

export function LeadRatingBadge({ rating }: { rating: string | null }) {
  if (!rating) return <Badge label="Unrated" variant="neutral" />
  const map: Record<string, BadgeVariant> = { hot: 'red', warm: 'amber', cold: 'accent' }
  return <Badge label={rating.charAt(0).toUpperCase() + rating.slice(1)} variant={map[rating] ?? 'neutral'} />
}
