'use client'

import { Suspense, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { useCTA } from '@/components/landing/cta-context'

function ThankYouContent() {
  const searchParams = useSearchParams()
  const { showThankYou, activeDialog } = useCTA()

  const type = searchParams.get('type') as 'waitlist' | 'call' | null

  useEffect(() => {
    // Only open the modal if it's not already open and we have a valid type
    if (type && activeDialog !== 'thank-you') {
      showThankYou(type)
    }
  }, [type, showThankYou, activeDialog])

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
