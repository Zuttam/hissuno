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
        'flex items-center gap-1 border-b border-[--border-subtle] px-6 py-2 overflow-x-auto scrollbar-hide',
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
        'relative shrink-0 px-4 py-2 text-sm font-medium transition-all duration-200',
        isActive
          ? 'text-(--foreground)'
          : 'text-(--text-tertiary) hover:text-(--text-secondary)',
        className
      )}
    >
      {children}
      {/* Active indicator underline */}
      <span
        className={cn(
          'absolute bottom-0 left-2 right-2 h-0.5 rounded-full transition-all duration-200',
          isActive
            ? 'bg-(--accent-primary) opacity-100'
            : 'bg-transparent opacity-0'
        )}
      />
    </button>
  )
}

interface TabsPanelProps {
  value: string
  children: ReactNode
  className?: string
  /** Keep the panel mounted when inactive (hidden via CSS). Useful for preserving form state. */
  forceMount?: boolean
}

export function TabsPanel({ value, children, className, forceMount }: TabsPanelProps) {
  const { value: selectedValue } = useTabsContext()
  const isActive = selectedValue === value

  if (!isActive && !forceMount) {
    return null
  }

  return (
    <div className={cn('flex-1 overflow-y-auto px-6 py-4', className)} hidden={!isActive}>
      {children}
    </div>
  )
}
