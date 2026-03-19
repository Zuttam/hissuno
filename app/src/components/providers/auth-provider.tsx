'use client'

import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react'
import { SessionProvider, useSession } from 'next-auth/react'

interface AuthUser {
  id: string
  email?: string | null
  name?: string | null
  image?: string | null
}

interface AuthContextValue {
  user: AuthUser | null
  isLoading: boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

function AuthContextBridge({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession()
  const isLoading = status === 'loading'
  const user = useMemo(
    () =>
      session?.user
        ? {
            id: session.user.id!,
            email: session.user.email,
            name: session.user.name,
            image: session.user.image,
          }
        : null,
    [session?.user?.id, session?.user?.email, session?.user?.name, session?.user?.image]
  )

  useEffect(() => {
    if (user) {
      // Auto-set consent for authenticated users (registration = acceptance)
      const consentKey = 'hissuno_cookie_consent'
      if (!localStorage.getItem(consentKey)) {
        localStorage.setItem(consentKey, 'accepted')
      }
    }
  }, [user])

  return (
    <AuthContext.Provider value={{ user, isLoading }}>
      {children}
    </AuthContext.Provider>
  )
}

interface AuthProviderProps {
  children: ReactNode
}

/**
 * Auth provider that manages the current user state across the app.
 * Wrap your app with this provider to use the `useUser` hook.
 */
export function AuthProvider({ children }: AuthProviderProps) {
  return (
    <SessionProvider>
      <AuthContextBridge>
        {children}
      </AuthContextBridge>
    </SessionProvider>
  )
}

/**
 * Hook to get the current authenticated user.
 * Must be used within an AuthProvider.
 */
export function useUser(): AuthContextValue {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useUser must be used within an AuthProvider')
  }

  return context
}
