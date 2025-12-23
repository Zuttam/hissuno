import { formatBytes } from '@/lib/projects/source-code-utils'
import type { FolderSummaryCardProps } from './types'

export function FolderSummaryCard({ summary, onClear }: FolderSummaryCardProps) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300">
      <div className="space-y-1">
        <p className="font-semibold text-slate-700 dark:text-slate-100">{summary.name}</p>
        <p>
          {summary.fileCount} files · {formatBytes(summary.totalBytes)}
        </p>
      </div>
      <button
        type="button"
        onClick={onClear}
        className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600 transition hover:border-slate-400 hover:text-slate-900 dark:border-slate-700 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:text-white"
      >
        Remove
      </button>
    </div>
  )
}

