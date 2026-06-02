import type { LucideIcon } from 'lucide-react'
import { Clock } from 'lucide-react'

interface ComingSoonProps {
  title: string
  description: string
  icon?: LucideIcon
}

export function ComingSoon({ title, description, icon: Icon = Clock }: ComingSoonProps) {
  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex flex-col items-center justify-center text-center py-24 border border-dashed border-[var(--border)] rounded-2xl bg-[var(--surface)]">
        <div className="w-14 h-14 rounded-2xl bg-[var(--surface2)] border border-[var(--border)] flex items-center justify-center mb-5">
          <Icon size={24} className="text-[var(--text3)]" />
        </div>
        <h2 className="text-lg font-bold text-[var(--text)] mb-2">{title}</h2>
        <p className="text-sm text-[var(--text3)] max-w-xs leading-relaxed">{description}</p>
        <div className="mt-6 flex items-center gap-1.5 text-xs text-[var(--text3)] bg-[var(--surface2)] border border-[var(--border)] px-3 py-1.5 rounded-full">
          <Clock size={11} />
          Coming soon
        </div>
      </div>
    </div>
  )
}
