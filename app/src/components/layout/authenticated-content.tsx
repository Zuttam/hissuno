import type { ReactNode } from 'react'

export function AuthenticatedContent({ children }: { children: ReactNode }) {
  return (
    <main className="relative flex-1 min-w-0 flex flex-col overflow-y-auto">
      {children}
    </main>
  )
}
