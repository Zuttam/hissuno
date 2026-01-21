'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import posthog from 'posthog-js'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'

interface AuthContextValue {
  user: User | null
  isLoading: boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

interface AuthProviderProps {
  children: ReactNode
  /** Optional server-rendered user for SSR hydration */
  initialUser?: User | null
}

/**
 * Auth provider that manages the current user state across the app.
 * Wrap your app with this provider to use the `useUser` hook.
 */
export function AuthProvider({ children, initialUser = null }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(initialUser)
  const [isLoading, setIsLoading] = useState(!initialUser)

  useEffect(() => {
    const supabase = createClient()

    // Fetch user on mount if no initial user provided
    if (!initialUser) {
      supabase.auth.getUser().then(({ data: { user } }) => {
        setUser(user)
        setIsLoading(false)
      })
    }

    // Listen for auth state changes (login, logout, token refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setIsLoading(false)

      // PostHog user identification
      // Authenticated users have implicitly accepted terms by registering
      if (session?.user) {
        // Auto-set consent for authenticated users (registration = acceptance)
        const consentKey = 'hissuno_cookie_consent'
        if (!localStorage.getItem(consentKey)) {
          localStorage.setItem(consentKey, 'accepted')
        }

        posthog.identify(session.user.id, {
          email: session.user.email,
          signup_method: session.user.app_metadata?.provider || 'email',
          created_at: session.user.created_at,
        })
      } else {
        posthog.reset()
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [initialUser])

  return (
    <AuthContext.Provider value={{ user, isLoading }}>
      {children}
    </AuthContext.Provider>
  )
}

/**
 * Hook to get the current authenticated user.
 * Must be used within an AuthProvider.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { user, isLoading } = useUser()
 *
 *   if (isLoading) return <Spinner />
 *   if (!user) return <LoginPrompt />
 *
 *   return <div>Hello, {user.email}</div>
 * }
 * ```
 */
export function useUser(): AuthContextValue {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useUser must be used within an AuthProvider')
  }

  return context
}
