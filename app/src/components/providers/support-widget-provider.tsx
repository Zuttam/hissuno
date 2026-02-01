'use client'

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'

interface SupportWidgetControls {
  setInput: (value: string) => void
}

interface SupportWidgetContextValue {
  isOpen: boolean
  open: () => void
  close: () => void
  openWithPrompt: (prompt: string) => void
  registerControls: (controls: SupportWidgetControls) => void
}

const SupportWidgetContext = createContext<SupportWidgetContextValue | null>(null)

export function useSupportWidget() {
  const context = useContext(SupportWidgetContext)
  if (!context) {
    throw new Error('useSupportWidget must be used within SupportWidgetProvider')
  }
  return context
}

export function SupportWidgetProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const controlsRef = useRef<SupportWidgetControls | null>(null)
  const pendingPromptRef = useRef<string | null>(null)

  const registerControls = useCallback((controls: SupportWidgetControls) => {
    controlsRef.current = controls
    // If there's a pending prompt, apply it now
    if (pendingPromptRef.current) {
      controls.setInput(pendingPromptRef.current)
      pendingPromptRef.current = null
    }
  }, [])

  const open = useCallback(() => setIsOpen(true), [])
  const close = useCallback(() => setIsOpen(false), [])

  const openWithPrompt = useCallback((prompt: string) => {
    if (controlsRef.current) {
      controlsRef.current.setInput(prompt)
    } else {
      pendingPromptRef.current = prompt
    }
    setIsOpen(true)
  }, [])

  return (
    <SupportWidgetContext.Provider value={{ isOpen, open, close, openWithPrompt, registerControls }}>
      {children}
    </SupportWidgetContext.Provider>
  )
}
