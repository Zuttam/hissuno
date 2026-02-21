'use client'

import type { ReactNode } from 'react'
import { useSupportWidget } from '@/components/providers/support-widget-provider'

export function AuthenticatedContent({ children }: { children: ReactNode }) {
  const { isOpen, panelWidth } = useSupportWidget()

  return (
    <main
      className="relative flex-1 min-w-0 flex flex-col overflow-y-auto transition-[margin] duration-300 ease-out"
      style={{ marginRight: isOpen ? panelWidth : 0 }}
    >
      {children}
    </main>
  )
}
