'use client'
import { useState, useEffect } from 'react'
import {useFeatureFlagEnabled, usePostHog} from 'posthog-js/react'


type UseFeatureFlagResult = {
  enabled?: boolean
  isLoading: boolean
}
/**
 * Hook to check a PostHog feature flag.
 * Returns { enabled: true } if PostHog is not configured (no gating in dev).
 */
export function useFeatureFlag(key: string): UseFeatureFlagResult {
  const posthog = usePostHog() 
  const [flagsLoaded, setFlagsLoaded] = useState(false)  
  const [flagValue, setFlagValue] = useState<boolean | undefined>(undefined)

  useEffect(() => {  
    posthog.onFeatureFlags(() => {  
      setFlagsLoaded(true)  
      console.debug(`[useFeatureFlag] Flags loaded:`, posthog.featureFlags.getFlags())
      setFlagValue(posthog.isFeatureEnabled(key))  
    })  
  }, [posthog, key])

  if (!flagsLoaded) {  
    return { enabled: false, isLoading: true }
  }

  return { enabled: flagValue, isLoading: false }
}
