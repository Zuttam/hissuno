'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

const SIDEBAR_COLLAPSED_KEY = 'hissuno-sidebar-collapsed'
const SIDEBAR_WIDTH_KEY = 'hissuno-sidebar-width'
const DEFAULT_WIDTH = 240
const MIN_WIDTH = 180
const MAX_WIDTH = 480
const COLLAPSED_WIDTH = 64

export interface SidebarState {
  isCollapsed: boolean
  isMobileOpen: boolean
  sidebarWidth: number
  isResizing: boolean
  toggleCollapsed: () => void
  setMobileOpen: (open: boolean) => void
  closeMobile: () => void
  onResizeStart: (e: React.MouseEvent) => void
}

export function useSidebarState(): SidebarState {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_WIDTH)
  const [isResizing, setIsResizing] = useState(false)
  const widthRef = useRef(DEFAULT_WIDTH)

  // Sync collapsed state and width from localStorage after hydration
  useEffect(() => {
    const stored = localStorage.getItem(SIDEBAR_COLLAPSED_KEY)
    if (stored === 'true') {
      setIsCollapsed(true)
    }
    const storedWidth = localStorage.getItem(SIDEBAR_WIDTH_KEY)
    if (storedWidth) {
      const w = Number(storedWidth)
      if (w >= MIN_WIDTH && w <= MAX_WIDTH) {
        setSidebarWidth(w)
        widthRef.current = w
      }
    }
  }, [])

  const toggleCollapsed = useCallback(() => {
    setIsCollapsed((prev) => {
      const next = !prev
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next))
      return next
    })
  }, [])

  const onResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'col-resize'

    const startX = e.clientX
    const startWidth = widthRef.current

    function onMouseMove(e: MouseEvent) {
      const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth + (e.clientX - startX)))
      widthRef.current = newWidth
      setSidebarWidth(newWidth)
    }

    function onMouseUp() {
      setIsResizing(false)
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
      localStorage.setItem(SIDEBAR_WIDTH_KEY, String(widthRef.current))
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
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
    sidebarWidth: isCollapsed ? COLLAPSED_WIDTH : sidebarWidth,
    isResizing,
    toggleCollapsed,
    setMobileOpen,
    closeMobile,
    onResizeStart,
  }
}
