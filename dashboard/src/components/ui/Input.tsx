'use client'

import { InputHTMLAttributes, TextareaHTMLAttributes, forwardRef } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, hint, className = '', ...props },
  ref
) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-xs font-bold uppercase tracking-wider text-[var(--text3)]">
          {label}
        </label>
      )}
      <input
        ref={ref}
        className={[
          error ? 'border-[var(--red)]' : '',
          className,
        ].join(' ')}
        {...props}
      />
      {error && <p className="text-xs text-[var(--red)]">{error}</p>}
      {hint && !error && <p className="text-xs text-[var(--text3)]">{hint}</p>}
    </div>
  )
})

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
  hint?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, error, hint, className = '', ...props },
  ref
) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-xs font-bold uppercase tracking-wider text-[var(--text3)]">
          {label}
        </label>
      )}
      <textarea
        ref={ref}
        rows={4}
        className={[error ? 'border-[var(--red)]' : '', className].join(' ')}
        {...props}
      />
      {error && <p className="text-xs text-[var(--red)]">{error}</p>}
      {hint && !error && <p className="text-xs text-[var(--text3)]">{hint}</p>}
    </div>
  )
})
