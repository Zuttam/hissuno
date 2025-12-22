import { FormField } from '@/components/ui'
import type { UploadFolderPickerProps } from './types'
import { FolderSummaryCard } from './folder-summary-card'

export function UploadFolderPicker({
  fileInputRef,
  gitignoreInputRef,
  onSelectFolderClick,
  onFolderChange,
  folderSummary,
  onResetFolderSelection,
  gitignoreSelection,
  onSelectGitignoreClick,
  onGitignoreChange,
  onClearGitignoreSelection,
}: UploadFolderPickerProps) {
  return (
    <FormField
      as="div"
      label="Select project folder"
      labelClassName="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
    >
      <div className="space-y-3 rounded-xl border border-slate-200 bg-white px-4 py-4 dark:border-slate-700 dark:bg-slate-900">
        <input ref={fileInputRef} type="file" className="sr-only" multiple onChange={onFolderChange} />
        <input
          ref={gitignoreInputRef}
          type="file"
          className="sr-only"
          accept=".gitignore,text/plain"
          onChange={onGitignoreChange}
        />
        <button
          type="button"
          onClick={onSelectFolderClick}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-400 hover:text-slate-900 dark:border-slate-700 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:text-white"
        >
          Select folder
        </button>
        {folderSummary ? (
          <FolderSummaryCard summary={folderSummary} onClear={onResetFolderSelection} />
        ) : (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Choose the root folder of the project you want to analyze. We&apos;ll copy the structure exactly.
          </p>
        )}

        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              {gitignoreSelection ? (
                <>
                  <p className="font-semibold text-slate-700 dark:text-slate-100">
                    {gitignoreSelection.source === 'explicit' ? 'Uploaded .gitignore' : 'Auto-detected .gitignore'}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">{gitignoreSelection.relativePath}</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Files matching these rules are skipped before upload.
                  </p>
                </>
              ) : (
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  No .gitignore selected. All files in the folder will be uploaded.
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onSelectGitignoreClick}
                className="rounded-full border border-slate-300 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600 transition hover:border-slate-400 hover:text-slate-900 dark:border-slate-700 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:text-white"
              >
                Upload .gitignore
              </button>
              {gitignoreSelection?.source === 'explicit' ? (
                <button
                  type="button"
                  onClick={onClearGitignoreSelection}
                  className="rounded-full border border-rose-200 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-rose-600 transition hover:border-rose-300 hover:text-rose-700 dark:border-rose-900/60 dark:text-rose-200 dark:hover:border-rose-800 dark:hover:text-rose-100"
                >
                  Remove
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </FormField>
  )
}

