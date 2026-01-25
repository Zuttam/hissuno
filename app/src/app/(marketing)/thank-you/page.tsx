'use client'

import { Suspense, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { useCTA } from '@/components/landing/cta-context'

function ThankYouContent() {
  const searchParams = useSearchParams()
  const { showThankYou } = useCTA()
  const hasOpened = useRef(false)

  const type = searchParams.get('type') as 'waitlist' | 'call' | null

  useEffect(() => {
    // Only open the modal once on mount
    if (type && !hasOpened.current) {
      hasOpened.current = true
      showThankYou(type)
    }
  }, [type, showThankYou])

  // The modal is rendered by the layout, this page just triggers it
  return null
}

export default function ThankYouPage() {
  return (
    <Suspense fallback={null}>
      <ThankYouContent />
    </Suspense>
  )
}
