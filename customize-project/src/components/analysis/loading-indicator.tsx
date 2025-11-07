'use client'

interface LoadingIndicatorProps {
  message?: string
}

export function LoadingIndicator({ message = 'Loading…' }: LoadingIndicatorProps) {
  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-white/60 backdrop-blur-sm dark:bg-slate-950/40">
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-lg shadow-blue-500/10 dark:border-slate-800 dark:bg-slate-900/90">
        <div className="flex gap-2">
          <span className="h-2 w-2 animate-bounce rounded-full bg-blue-500 [animation-delay:-0.12s]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-blue-500 [animation-delay:-0.24s]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-blue-500" />
        </div>
        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{message}</p>
      </div>
    </div>
  )
}

