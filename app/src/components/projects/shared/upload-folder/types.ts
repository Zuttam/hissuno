import type { ChangeEvent, RefObject } from 'react'
import type { FileSummary, GitignoreSelection } from '@/lib/projects/source-code-utils'

export type UploadFolderPickerProps = {
  fileInputRef: RefObject<HTMLInputElement | null>
  gitignoreInputRef: RefObject<HTMLInputElement | null>
  onSelectFolderClick: () => void
  onFolderChange: (event: ChangeEvent<HTMLInputElement>) => void
  folderSummary: FileSummary | null
  onResetFolderSelection: () => void
  gitignoreSelection: GitignoreSelection | null
  onSelectGitignoreClick: () => void
  onGitignoreChange: (event: ChangeEvent<HTMLInputElement>) => void
  onClearGitignoreSelection: () => void
}

export type FolderSummaryCardProps = {
  summary: FileSummary
  onClear: () => void
}

