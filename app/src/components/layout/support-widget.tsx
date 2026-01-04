'use client'

import { useEffect, useState } from 'react'
import { HissunoWidget } from '@hissuno/widget'
import { useUser } from '@/components/providers/auth-provider'
import { HISSUNO_SUPPORT_PROJECT_ID } from '@/lib/consts'

export function SupportWidget() {
  const { user, isLoading } = useUser()
  const [widgetToken, setWidgetToken] = useState<string | undefined>()

  // Fetch widget token for authenticated users
  useEffect(() => {
    if (!user) {
      setWidgetToken(undefined)
      return
    }

    fetch('/api/widget-token')
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (data?.token) {
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
    />
  )
}
