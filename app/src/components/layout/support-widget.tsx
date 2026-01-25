'use client'

import { useEffect, useState } from 'react'
import { HissunoWidget } from '@hissuno/widget'
import { useUser } from '@/components/providers/auth-provider'
import { useSupportWidget } from '@/components/providers/support-widget-provider'
import { HISSUNO_SUPPORT_PROJECT_ID } from '@/lib/consts'

const WIDGET_TOKEN_KEY = 'hissuno_widget_token'
const TOKEN_EXPIRY_BUFFER_MS = 5 * 60 * 1000 // 5 minutes

// Helper to decode JWT exp claim (no library needed)
function getTokenExpiration(token: string): number | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return payload.exp ? payload.exp * 1000 : null // Convert to ms
  } catch {
    return null
  }
}

// Helper to get/validate cached token
function getCachedToken(userId: string): string | null {
  const key = `${WIDGET_TOKEN_KEY}_${userId}`
  const token = localStorage.getItem(key)
  if (!token) return null

  const exp = getTokenExpiration(token)
  if (!exp || Date.now() > exp - TOKEN_EXPIRY_BUFFER_MS) {
    localStorage.removeItem(key)
    return null
  }
  return token
}

// Helper to cache token
function cacheToken(userId: string, token: string): void {
  localStorage.setItem(`${WIDGET_TOKEN_KEY}_${userId}`, token)
}

export function SupportWidget() {
  const { user, isLoading } = useUser()
  const { isOpen, open, close, registerControls } = useSupportWidget()
  const [widgetToken, setWidgetToken] = useState<string | undefined>()

  // Fetch widget token for authenticated users (with localStorage caching)
  useEffect(() => {
    if (!user) {
      setWidgetToken(undefined)
      return
    }

    // Check for valid cached token first
    const cached = getCachedToken(user.id)
    if (cached) {
      setWidgetToken(cached)
      return
    }

    // Fetch new token
    fetch('/api/widget-token')
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (data?.token) {
          cacheToken(user.id, data.token)
          setWidgetToken(data.token)
        }
      })
      .catch((err) => {
        console.warn('[SupportWidget] Failed to fetch widget token:', err)
      })
  }, [user])

  // Don't render until we know the user state
  if (isLoading) return null

  return (
    <HissunoWidget
      projectId={HISSUNO_SUPPORT_PROJECT_ID}
      widgetToken={widgetToken}
      userId={user?.id}
      userMetadata={user ? {
        email: user.email ?? '',
        ...(user.user_metadata?.full_name && { name: user.user_metadata.full_name }),
      } : undefined}
      defaultOpen={isOpen}
      onOpen={open}
      onClose={close}
      onControlsReady={registerControls}
    />
  )
}
