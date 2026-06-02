'use client'

import { useEffect, useState } from 'react'
import { Sun, Moon } from 'lucide-react'

export function ThemeToggle() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')

  useEffect(() => {
    const stored = localStorage.getItem('dc-theme') as 'dark' | 'light' | null
    const current = document.documentElement.getAttribute('data-theme') as 'dark' | 'light' | null
    setTheme(stored ?? current ?? 'dark')
  }, [])

  function toggle() {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    localStorage.setItem('dc-theme', next)
    document.documentElement.setAttribute('data-theme', next)
  }

  return (
    <button
      onClick={toggle}
      className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-[var(--text3)] hover:text-[var(--text2)] hover:bg-[var(--surface2)] transition-all w-full"
      title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {theme === 'dark'
        ? <Sun size={16} className="flex-shrink-0" />
        : <Moon size={16} className="flex-shrink-0" />}
      {theme === 'dark' ? 'Light mode' : 'Dark mode'}
    </button>
  )
}
