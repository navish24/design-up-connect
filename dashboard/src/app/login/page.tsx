'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'

type Step = 'contact' | 'otp' | 'role_switch'
type LoginMode = 'otp' | 'password'

interface RoleOption {
  label: string
  sub: string
  role: string
  redirect: string
}

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()

  const [step, setStep] = useState<Step>('contact')
  const [loginMode, setLoginMode] = useState<LoginMode>('password')
  const [contact, setContact] = useState('')
  const [password, setPassword] = useState('')
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [roleOptions, setRoleOptions] = useState<RoleOption[]>([])

  const isEmail = contact.includes('@')

  async function signInWithPassword() {
    setLoading(true)
    setError('')
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: contact,
        password,
      })
      if (error) throw error
      await resolveRole(data.user?.id ?? '')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Sign in failed')
    } finally {
      setLoading(false)
    }
  }

  async function sendOTP() {
    setLoading(true)
    setError('')
    try {
      const { error } = isEmail
        ? await supabase.auth.signInWithOtp({ email: contact })
        : await supabase.auth.signInWithOtp({ phone: contact })
      if (error) throw error
      setStep('otp')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to send OTP')
    } finally {
      setLoading(false)
    }
  }

  async function verifyOTP() {
    setLoading(true)
    setError('')
    try {
      const { data, error } = isEmail
        ? await supabase.auth.verifyOtp({ email: contact, token: otp, type: 'email' })
        : await supabase.auth.verifyOtp({ phone: contact, token: otp, type: 'sms' })
      if (error) throw error
      await resolveRole(data.user?.id ?? '')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Invalid OTP')
    } finally {
      setLoading(false)
    }
  }

  async function resolveRole(userId: string) {
    if (!userId) throw new Error('No user returned')

    // Query with individual error handling so a missing table doesn't hang
    const [profileResult, brandMemberResult] = await Promise.all([
      supabase.from('users').select('role, full_name').eq('id', userId).single(),
      supabase.from('brand_members').select('brand_id, brands(name)').eq('user_id', userId).eq('role', 'admin').single(),
    ])

    const profile = profileResult.data
    const brandMember = brandMemberResult.data

    const options: RoleOption[] = []

    if (profile?.role === 'organiser') {
      options.push({ label: profile.full_name ?? 'Organiser', sub: 'Organiser Dashboard', role: 'organiser', redirect: '/organiser' })
    }
    if (profile?.role === 'gate_staff') {
      options.push({ label: 'Gate Staff', sub: 'Gate Interface', role: 'gate_staff', redirect: '/gate' })
    }
    if (brandMember) {
      const brandName = (brandMember.brands as unknown as { name: string } | null)?.name ?? 'Brand'
      options.push({ label: brandName, sub: 'Brand Dashboard', role: 'brand_admin', redirect: '/brand' })
    }
    if (profile && !profile.role) {
      options.push({ label: profile.full_name ?? 'Personal', sub: 'Personal Account', role: 'visitor', redirect: '/' })
    }

    // No role found — new user, send to brand onboarding
    if (options.length === 0) {
      router.push('/brand/onboarding/identity')
      return
    }
    if (options.length === 1) {
      router.push(options[0].redirect)
      return
    }

    setRoleOptions(options)
    setStep('role_switch')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg)] px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="text-2xl font-bold tracking-tight text-[var(--accent)] mb-1">DESIGNUP</div>
          <div className="text-sm text-[var(--text3)]">Brand & Organiser Dashboard</div>
        </div>

        {/* Step: Enter contact */}
        {step === 'contact' && (
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-8 flex flex-col gap-5">
            <div>
              <h1 className="text-lg font-bold text-[var(--text)] mb-1">Sign in</h1>
              <p className="text-sm text-[var(--text3)]">Enter your email to continue</p>
            </div>

            {/* Mode toggle */}
            <div className="flex gap-1 bg-[var(--surface2)] rounded-xl p-1">
              {(['password', 'otp'] as LoginMode[]).map(m => (
                <button
                  key={m}
                  onClick={() => { setLoginMode(m); setError('') }}
                  className={[
                    'flex-1 py-1.5 rounded-lg text-xs font-medium transition-all',
                    loginMode === m
                      ? 'bg-[var(--accent)] text-black'
                      : 'text-[var(--text3)] hover:text-[var(--text2)]',
                  ].join(' ')}
                >
                  {m === 'password' ? 'Password' : 'Email OTP'}
                </button>
              ))}
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-[var(--text3)]">Email</label>
                <input
                  type="email"
                  value={contact}
                  onChange={e => setContact(e.target.value)}
                  placeholder="you@example.com"
                  autoFocus
                />
              </div>

              {loginMode === 'password' && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-[var(--text3)]">Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    onKeyDown={e => e.key === 'Enter' && contact && password && signInWithPassword()}
                  />
                </div>
              )}
            </div>

            {error && <p className="text-xs text-[var(--red)]">{error}</p>}

            <Button
              onClick={loginMode === 'password' ? signInWithPassword : sendOTP}
              loading={loading}
              disabled={!contact || (loginMode === 'password' && !password)}
            >
              {loginMode === 'password' ? 'Sign In' : 'Send OTP'}
            </Button>
          </div>
        )}

        {/* Step: Enter OTP */}
        {step === 'otp' && (
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-8 flex flex-col gap-5">
            <div>
              <h1 className="text-lg font-bold text-[var(--text)] mb-1">Enter OTP</h1>
              <p className="text-sm text-[var(--text3)]">
                Code sent to <span className="text-[var(--text2)] font-medium">{contact}</span>
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-[var(--text3)]">One-Time Code</label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={otp}
                onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                placeholder="6-digit code"
                onKeyDown={e => e.key === 'Enter' && otp.length === 6 && verifyOTP()}
                autoFocus
                style={{ letterSpacing: '0.3em', fontSize: '20px', textAlign: 'center' }}
              />
            </div>
            {error && <p className="text-xs text-[var(--red)]">{error}</p>}
            <Button onClick={verifyOTP} loading={loading} disabled={otp.length < 6}>
              Verify & Sign In
            </Button>
            <button
              className="text-xs text-[var(--text3)] hover:text-[var(--text2)] transition-colors"
              onClick={() => { setStep('contact'); setOtp(''); setError('') }}
            >
              ← Back
            </button>
          </div>
        )}

        {/* Step: Role switcher */}
        {step === 'role_switch' && (
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-8 flex flex-col gap-4">
            <div>
              <h1 className="text-lg font-bold text-[var(--text)] mb-1">Continue as</h1>
              <p className="text-sm text-[var(--text3)]">This account is linked to multiple roles</p>
            </div>
            <div className="flex flex-col gap-3 mt-1">
              {roleOptions.map(opt => (
                <button
                  key={opt.role}
                  onClick={() => router.push(opt.redirect)}
                  className="flex items-center gap-4 p-4 rounded-xl border border-[var(--border)] bg-[var(--surface2)] hover:border-[var(--accent)] hover:bg-[var(--accent-dim)] transition-all text-left"
                >
                  <div className="w-10 h-10 rounded-xl bg-[var(--accent-dim)] border border-[var(--accent)] flex items-center justify-center text-[var(--accent)] font-bold text-sm flex-shrink-0">
                    {opt.label.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="font-semibold text-sm text-[var(--text)]">{opt.label}</div>
                    <div className="text-xs text-[var(--text3)] mt-0.5">{opt.sub}</div>
                  </div>
                  <span className="ml-auto text-[var(--text3)]">→</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
