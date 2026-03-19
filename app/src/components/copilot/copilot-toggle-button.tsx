'use client'

import { useCopilot } from '@/components/providers/copilot-provider'

export function CopilotToggleButton() {
  const { isOpen, toggle } = useCopilot()

  return (
    <button
      type="button"
      onClick={toggle}
      className={`relative flex items-center justify-center p-1.5 transition-colors ${
        isOpen
          ? 'text-[color:var(--accent)]'
          : 'text-[color:var(--text-secondary)] hover:text-[color:var(--foreground)]'
      }`}
      aria-label="Co-pilot (Cmd+.)"
      title="Co-pilot (Cmd+.)"
    >
      <svg
        className="h-5 w-5"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    </button>
  )
}
