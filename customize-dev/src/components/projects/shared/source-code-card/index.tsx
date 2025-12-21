import { Alert, Card, SectionHeader, ToggleGroup } from '@/components/ui'
import type { SourceCodeCardProps } from '@/components/projects/shared/types'
import { UploadFolderPicker } from '@/components/projects/shared/upload-folder/upload-folder-picker'
import { GitHubRepoPicker } from '@/components/projects/shared/github-repo-picker'

export function SourceCodeCard({
  uploadProps,
  githubProps,
  codebaseError,
}: SourceCodeCardProps) {
  const { codebaseMode, onCodebaseModeChange } = uploadProps

  return (
    <Card className="space-y-6">
      <SectionHeader
        title="Source Code"
        description="Upload your project folder or connect via GitHub. You can skip and add it later."
      />

      <ToggleGroup
        value={codebaseMode}
        onChange={onCodebaseModeChange}
        options={[
          { value: 'upload-folder', label: 'Upload folder' },
          { value: 'github', label: 'GitHub' },
        ]}
      />

      {codebaseMode === 'upload-folder' ? (
        <UploadFolderPicker
          fileInputRef={uploadProps.fileInputRef}
          gitignoreInputRef={uploadProps.gitignoreInputRef}
          onSelectFolderClick={uploadProps.onSelectFolderClick}
          onFolderChange={uploadProps.onFolderChange}
          folderSummary={uploadProps.folderSummary}
          onResetFolderSelection={uploadProps.onResetFolderSelection}
          gitignoreSelection={uploadProps.gitignoreSelection}
          onSelectGitignoreClick={uploadProps.onSelectGitignoreClick}
          onGitignoreChange={uploadProps.onGitignoreChange}
          onClearGitignoreSelection={uploadProps.onClearGitignoreSelection}
        />
      ) : githubProps ? (
        <GitHubRepoPicker
          selectedRepo={githubProps.selectedRepo}
          selectedBranch={githubProps.selectedBranch}
          onRepoChange={githubProps.onRepoChange}
          onBranchChange={githubProps.onBranchChange}
          hasGitHubIntegration={githubProps.hasGitHubIntegration}
          onConnectGitHub={githubProps.onConnectGitHub}
          isConnecting={githubProps.isConnecting}
        />
      ) : null}

      {codebaseError ? <Alert variant="danger">{codebaseError}</Alert> : null}
    </Card>
  )
}
