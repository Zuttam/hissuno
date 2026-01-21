'use client'

import { useCallback, useEffect, useState } from 'react'

const SIDEBAR_COLLAPSED_KEY = 'hissuno-sidebar-collapsed'

export interface SidebarState {
  isCollapsed: boolean
  isMobileOpen: boolean
  toggleCollapsed: () => void
  setMobileOpen: (open: boolean) => void
  closeMobile: () => void
}

function getInitialCollapsedState(): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true'
}

export function useSidebarState(): SidebarState {
  const [isCollapsed, setIsCollapsed] = useState(getInitialCollapsedState)
  const [isMobileOpen, setIsMobileOpen] = useState(false)

  const toggleCollapsed = useCallback(() => {
    setIsCollapsed((prev) => {
      const next = !prev
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next))
      return next
    })
  }, [])

  const setMobileOpen = useCallback((open: boolean) => {
    setIsMobileOpen(open)
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
  }, [])

  const closeMobile = useCallback(() => {
    setMobileOpen(false)
  }, [setMobileOpen])

  // Close mobile sidebar on escape key
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && isMobileOpen) {
        setMobileOpen(false)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isMobileOpen, setMobileOpen])

  // Cleanup body overflow on unmount
  useEffect(() => {
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  return {
    isCollapsed,
    isMobileOpen,
    toggleCollapsed,
    setMobileOpen,
    closeMobile,
  }
}
