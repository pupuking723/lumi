'use client'

import { cn } from '@/lib/utils'
import { ChevronDown, LogOut } from 'lucide-react'
import { signIn, signOut, useSession } from 'next-auth/react'
import { useEffect, useRef, useState } from 'react'
import { GoogleIcon } from './google-icon'

function displayInitial(name?: string | null, email?: string | null) {
  return (name?.trim().charAt(0) || email?.trim().charAt(0) || 'L').toUpperCase()
}

function UserAvatar({ image, name, email }: { image?: string | null; name?: string | null; email?: string | null }) {
  return (
    <span className="relative flex size-7 shrink-0 overflow-hidden rounded-full border border-white/80 bg-[#e7e4ec] text-[0.68rem] font-extrabold uppercase text-[#5f586f] shadow-[0_1px_0_rgba(255,255,255,0.9)_inset]">
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="" className="size-full object-cover" referrerPolicy="no-referrer" />
      ) : (
        <span className="flex size-full items-center justify-center">{displayInitial(name, email)}</span>
      )}
    </span>
  )
}

export function GoogleAuthButton({ compact = false, className }: { compact?: boolean; className?: string }) {
  const { data: session, status } = useSession()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const isLoading = status === 'loading'
  const isAuthenticated = status === 'authenticated'
  const authAvailable = Boolean(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID)
  const label = compact ? 'Sign in' : 'Continue with Google'
  const userName = session?.user?.name
  const userEmail = session?.user?.email
  const avatarUrl = session?.user?.image ?? session?.goclawUser?.avatar

  useEffect(() => {
    if (!menuOpen) return

    function handlePointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setMenuOpen(false)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [menuOpen])

  if (isAuthenticated && session.user) {
    return (
      <div ref={menuRef} className={cn('relative', compact ? 'inline-flex' : 'flex w-full', className)}>
        <button
          type="button"
          onClick={() => setMenuOpen(open => !open)}
          className={cn(
            'inline-flex min-w-0 items-center justify-center gap-2 rounded-full border border-white/75 bg-[#f7f6f8]/76 px-2.5 py-1.5 text-xs font-extrabold text-[#302d43] shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_16px_34px_rgba(42,39,55,0.16)] backdrop-blur-xl transition hover:bg-white/86',
            compact ? 'h-10 max-w-[10rem]' : 'h-11 w-full'
          )}
          aria-label="Account menu"
          aria-expanded={menuOpen}
          aria-haspopup="menu">
          <UserAvatar image={avatarUrl} name={userName} email={userEmail} />
          <span className="min-w-0 truncate">{compact ? (userName ?? 'Account') : (userName ?? userEmail ?? 'Account')}</span>
          <ChevronDown size={14} aria-hidden className={cn('shrink-0 text-[#7a7289] transition-transform', menuOpen && 'rotate-180')} />
        </button>

        {menuOpen && (
          <div role="menu" className={cn('absolute right-0 top-[calc(100%+0.5rem)] z-[80] w-64 overflow-hidden rounded-[8px] border border-white/80 bg-[#fffdf8]/96 p-2 text-[#302d43] shadow-[0_18px_48px_rgba(57,49,73,0.18)] backdrop-blur-xl', !compact && 'left-0 right-auto w-full min-w-64')}>
            <div className="flex items-center gap-3 border-b border-[#e8e0dd] px-2 py-2.5">
              <UserAvatar image={avatarUrl} name={userName} email={userEmail} />
              <div className="min-w-0">
                <p className="truncate text-sm font-extrabold">{userName ?? 'Google account'}</p>
                {userEmail && <p className="truncate text-xs font-semibold text-[#746d80]">{userEmail}</p>}
              </div>
            </div>

            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false)
                signOut({ callbackUrl: '/' })
              }}
              className="mt-2 flex h-10 w-full items-center gap-2 rounded-[8px] px-2.5 text-left text-sm font-bold text-[#534b61] transition hover:bg-[#f1ece7]">
              <LogOut size={16} aria-hidden />
              Sign out
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <button
      type="button"
      disabled={isLoading || !authAvailable}
      onClick={() =>
        signIn('google', {
          callbackUrl: typeof window === 'undefined' ? '/' : `${window.location.pathname}${window.location.search}`
        })
      }
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-full border border-white/75 bg-[#f7f6f8]/76 px-3 py-2 text-xs font-extrabold text-[#302d43] shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_16px_34px_rgba(42,39,55,0.16)] backdrop-blur-xl transition hover:bg-white/86 disabled:pointer-events-none disabled:opacity-45',
        compact ? 'h-10' : 'h-11 w-full',
        className
      )}
      aria-label={label}
      title={authAvailable ? label : 'Google login is not configured'}>
      <GoogleIcon className="size-4 shrink-0" aria-hidden />
      <span>{isLoading ? 'Checking...' : label}</span>
    </button>
  )
}
