import type { ProjectDetailsCardProps } from './types'
import { formatTimestamp } from './utils'

export function ProjectDetailsCard({ project, isLoading }: ProjectDetailsCardProps) {
  const source = project.source_code

  if (isLoading) {
    return (
      <div className="space-y-6 rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
        <div className="animate-pulse space-y-4">
          <div className="h-4 w-32 rounded bg-slate-200 dark:bg-slate-700" />
          <div className="space-y-2">
            <div className="h-3 w-full rounded bg-slate-200 dark:bg-slate-700" />
            <div className="h-3 w-3/4 rounded bg-slate-200 dark:bg-slate-700" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
      <div className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Project details
        </h3>
        <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
          <DetailRow label="Name" value={project.name} />
          <DetailRow label="Description" value={project.description ?? '—'} />
          <DetailRow label="Created" value={formatTimestamp(project.created_at)} />
          <DetailRow label="Updated" value={formatTimestamp(project.updated_at)} />
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Source details
        </h3>
        {source ? (
          <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
            <DetailRow label="Source type" value={source.kind ?? '—'} />
            {source.kind === 'github' && (
              <>
                <DetailRow label="Repository URL" value={source.repository_url ?? '—'} />
                <DetailRow label="Repository branch" value={source.repository_branch ?? '—'} />
              </>
            )}
            <DetailRow label="Source created" value={formatTimestamp(source.created_at)} />
            <DetailRow label="Source updated" value={formatTimestamp(source.updated_at)} />
          </div>
        ) : (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            No source code linked yet. Edit the project to attach shared code.
          </p>
        )}
      </div>
    </div>
  )
}

interface DetailRowProps {
  label: string
  value: string
}

function DetailRow({ label, value }: DetailRowProps) {
  return (
    <div className="flex flex-col">
      <span className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">{label}</span>
      <span className="text-sm text-slate-700 dark:text-slate-200">{value}</span>
    </div>
  )
}
