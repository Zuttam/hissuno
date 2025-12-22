import type { ChangeEvent, RefObject } from 'react'
import type { FileSummary, GitignoreSelection } from '@/lib/projects/source-code-utils'
import type { GitHubRepoSelection } from '@/components/projects/shared/github-repo-picker'

export type CodebaseMode = 'upload-folder' | 'github'

export type StepId = 'metadata' | 'source-code' | 'knowledge-sources'

export type FormState = {
  name: string
  codebaseMode: CodebaseMode
  codebaseFiles: File[]
  // GitHub-specific state
  githubRepo: GitHubRepoSelection | null
  githubBranch: string | null
}

export type ProjectDetailsCardProps = {
  name: string
  description: string
  onNameChange: (value: string) => void
  onDescriptionChange: (value: string) => void
}

export type UploadFolderProps = {
  codebaseMode: CodebaseMode
  onCodebaseModeChange: (mode: CodebaseMode) => void
  folderSummary: FileSummary | null
  gitignoreSelection: GitignoreSelection | null
  fileInputRef: RefObject<HTMLInputElement | null>
  gitignoreInputRef: RefObject<HTMLInputElement | null>
  onSelectFolderClick: () => void
  onFolderChange: (event: ChangeEvent<HTMLInputElement>) => void
  onSelectGitignoreClick: () => void
  onGitignoreChange: (event: ChangeEvent<HTMLInputElement>) => void
  onClearGitignoreSelection: () => void
  onResetFolderSelection: () => void
}

export type GitHubPickerProps = {
  selectedRepo: GitHubRepoSelection | null
  selectedBranch: string | null
  onRepoChange: (repo: GitHubRepoSelection | null) => void
  onBranchChange: (branch: string | null) => void
  hasGitHubIntegration: boolean
  onConnectGitHub: () => void
  isConnecting?: boolean
}

export type SourceCodeCardProps = {
  uploadProps: UploadFolderProps
  githubProps?: GitHubPickerProps
  codebaseError: string | null
}
