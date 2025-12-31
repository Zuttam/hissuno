'use client'

import { useTheme } from 'next-themes'
import { HissunoWidget } from '@hissuno/widget'
import { useUser } from '@/components/providers/auth-provider'

// Stable public key for the internal Hissuno Support project
// This key is created in seed.sql and should not change
const HISSUNO_SUPPORT_PUBLIC_KEY = 'pk_live_hissuno_internal_support'

export function SupportWidget() {
  const { user, isLoading } = useUser()
  const { resolvedTheme } = useTheme()

  // Don't render until we know the user and theme
  if (isLoading) return null

  return (
    <HissunoWidget
      publicKey={HISSUNO_SUPPORT_PUBLIC_KEY}
      userId={user?.id}
      userMetadata={user ? {
        email: user.email ?? '',
        ...(user.user_metadata?.full_name && { name: user.user_metadata.full_name }),
      } : undefined}
      theme={resolvedTheme === 'dark' ? 'dark' : 'light'}
      title="Hissuno Support"
      placeholder="How can we help you today?"
      initialMessage="Hi! I'm the Hissuno support assistant. How can I help you?"
    />
  )
}
