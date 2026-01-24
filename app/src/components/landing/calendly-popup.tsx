'use client'

import { useEffect } from 'react'
import { PopupModal, useCalendlyEventListener } from 'react-calendly'
import { trackCallBookingStarted, trackCallBookingCompleted } from '@/lib/event_tracking/events'

interface CalendlyPopupProps {
  isOpen: boolean
  onClose: () => void
  onBookingComplete: () => void
}

export function CalendlyPopup({ isOpen, onClose, onBookingComplete }: CalendlyPopupProps) {
  // Track when popup opens
  useEffect(() => {
    if (isOpen) {
      trackCallBookingStarted({})
    }
  }, [isOpen])

  // Listen for Calendly events
  useCalendlyEventListener({
    onEventScheduled: (e) => {
      trackCallBookingCompleted({
        eventUri: e.data.payload.event?.uri,
        inviteeUri: e.data.payload.invitee?.uri,
      })
      onBookingComplete()
    },
  })

  const calendlyUrl = process.env.NEXT_PUBLIC_CALENDLY_URL

  if (!calendlyUrl) {
    return null
  }

  return (
    <PopupModal
      url={calendlyUrl}
      onModalClose={onClose}
      open={isOpen}
      rootElement={typeof document !== 'undefined' ? document.body : undefined!}
    />
  )
}
