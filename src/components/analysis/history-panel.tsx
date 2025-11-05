'use client'

import type { AnalyzerHistoryItem } from '@/types/analyzer'

interface HistoryPanelProps {
  history: AnalyzerHistoryItem[]
  onSelect: (item: AnalyzerHistoryItem) => void
  selectedId?: string
}

export function HistoryPanel({ history, onSelect, selectedId }: HistoryPanelProps) {
  return (
    <div className="mt-auto border-t border-slate-200 bg-white/60 px-6 py-4 dark:border-slate-800 dark:bg-slate-900/50">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Recent analyses</p>
        <span className="text-xs text-slate-400">{history.length}</span>
      </div>
      <div className="mt-3 space-y-2 max-h-48 overflow-y-auto pr-2">
        {history.length === 0 && (
          <p className="text-xs text-slate-400">
            Your latest analyses will appear here for quick replay.
          </p>
        )}

        {history.map((item) => {
          const isActive = selectedId === item.id
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item)}
              className={`w-full rounded-lg border px-3 py-2 text-left text-xs transition ${
                isActive
                  ? 'border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-950/40 dark:text-blue-200'
                  : 'border-transparent bg-slate-100/60 text-slate-600 hover:border-slate-200 hover:bg-slate-100 dark:bg-slate-900/60 dark:text-slate-300'
              }`}
            >
              <p className="truncate font-medium">
                {item.prompt ? item.prompt : '(No prompt provided)'}
              </p>
              <p className="mt-1 flex items-center gap-2 text-[10px] uppercase tracking-wide text-slate-400">
                <span>
                  {item.source.kind === 'path' ? 'Path' : 'Upload'}
                </span>
                <span>•</span>
                <time dateTime={item.requestedAt}>
                  {new Date(item.requestedAt).toLocaleTimeString(undefined, {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </time>
              </p>
            </button>
          )
        })}
      </div>
    </div>
  )
}

