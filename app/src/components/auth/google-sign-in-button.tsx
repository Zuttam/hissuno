'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getStoredUTM } from '@/lib/analytics'

interface GoogleSignInButtonProps {
  redirectTo?: string
  onClick?: () => void
}

export function GoogleSignInButton({ redirectTo = '/projects', onClick }: GoogleSignInButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleGoogleSignIn = async () => {
    // Call onClick handler for tracking before redirect
    onClick?.()

    setIsLoading(true)
    setError(null)

    try {
      const supabase = createClient()

      // Build the callback URL with the intended redirect
      const callbackUrl = new URL('/auth/callback', window.location.origin)
      callbackUrl.searchParams.set('next', redirectTo)

      // Include stored UTM params in callback URL for attribution
      const storedUTM = getStoredUTM()
      if (storedUTM) {
        Object.entries(storedUTM).forEach(([key, value]) => {
          if (value) callbackUrl.searchParams.set(key, value)
        })
      }

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: callbackUrl.toString(),
        },
      })

      if (error) {
        setError(error.message)
        setIsLoading(false)
      }
      // If successful, the browser will be redirected to Google
    } catch (err) {
      setError('An unexpected error occurred')
      setIsLoading(false)
      console.error('[GoogleSignIn] Error:', err)
    }
  }

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={handleGoogleSignIn}
        disabled={isLoading}
        className="flex w-full items-center justify-center gap-3 rounded-[4px] border-2 border-[--border-subtle] bg-[--background] px-4 py-3 font-mono text-sm font-semibold text-[--foreground] transition hover:border-[--border-default] hover:bg-[--surface-raised] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[--accent-primary] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isLoading ? (
          <span className="uppercase tracking-wide">Connecting...</span>
        ) : (
          <>
            <GoogleIcon />
            <span className="uppercase tracking-wide">Continue with Google</span>
          </>
        )}
      </button>
      {error && (
        <p className="mt-2 text-center text-sm text-[--accent-danger]">{error}</p>
      )}
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
        fill="#4285F4"
      />
      <path
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z"
        fill="#34A853"
      />
      <path
        d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
        fill="#FBBC05"
      />
      <path
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
        fill="#EA4335"
      />
    </svg>
  )
}
