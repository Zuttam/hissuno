'use client'

import { useEffect } from 'react'
import { parseUTMFromObject, storeUTM } from '@/lib/event_tracking'

interface UTMCaptureProps {
  searchParams: Record<string, string | string[] | undefined>
}

/**
 * Client component that captures UTM parameters from the URL and stores them in sessionStorage.
 * Should be included on landing pages and signup pages.
 */
export function UTMCapture({ searchParams }: UTMCaptureProps) {
  useEffect(() => {
    const utm = parseUTMFromObject(searchParams)
    if (Object.keys(utm).length > 0) {
      storeUTM(utm)
    }
  }, [searchParams])

  return null
}
