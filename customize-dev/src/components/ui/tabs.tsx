'use client'

import { ReactNode, createContext, useContext } from 'react'
import { cn } from '@/lib/utils/class'

type TabsContextValue = {
  value: string
  onChange: (value: string) => void
}

const TabsContext = createContext<TabsContextValue | undefined>(undefined)

function useTabsContext() {
  const context = useContext(TabsContext)
  if (!context) {
    throw new Error('Tabs compound components must be used within Tabs')
  }
  return context
}

interface TabsProps {
  value: string
  onChange: (value: string) => void
  children: ReactNode
  className?: string
}

export function Tabs({ value, onChange, children, className }: TabsProps) {
  return (
    <TabsContext.Provider value={{ value, onChange }}>
      <div className={cn('flex h-full flex-col', className)}>{children}</div>
    </TabsContext.Provider>
  )
}

interface TabsListProps {
  children: ReactNode
  className?: string
}

export function TabsList({ children, className }: TabsListProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 border-b-2 border-[--border-subtle] px-6 py-3',
        className
      )}
    >
      {children}
    </div>
  )
}

interface TabProps {
  value: string
  children: ReactNode
  className?: string
}

export function Tab({ value, children, className }: TabProps) {
  const { value: selectedValue, onChange } = useTabsContext()
  const isActive = selectedValue === value

  return (
    <button
      type="button"
      onClick={() => onChange(value)}
      className={cn(
        'rounded-[4px] border-2 px-4 py-2 text-sm font-mono font-semibold uppercase tracking-wide transition',
        isActive
          ? 'border-[--border] bg-[--foreground] text-[--background]'
          : 'border-[--border-subtle] bg-transparent text-[--text-secondary] hover:border-[--border] hover:bg-[--surface-hover]',
        className
      )}
    >
      {children}
    </button>
  )
}

interface TabsPanelProps {
  value: string
  children: ReactNode
  className?: string
}

export function TabsPanel({ value, children, className }: TabsPanelProps) {
  const { value: selectedValue } = useTabsContext()

  if (selectedValue !== value) {
    return null
  }

  return <div className={cn('flex-1 overflow-y-auto px-6 py-4', className)}>{children}</div>
}

