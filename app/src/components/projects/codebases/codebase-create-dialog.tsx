'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Plug } from 'lucide-react'
import { Button, Dialog, FormField, InlineAlert, Input, Textarea } from '@/components/ui'
import { createCodebase, type CodebaseRecord } from '@/lib/api/codebases'

interface Props {
  open: boolean
  projectId: string
  onCloseAction: () => void
  onCreatedAction: (codebase: CodebaseRecord) => void
}

export function CodebaseCreateDialog({
  open,
  projectId,
  onCloseAction,
  onCreatedAction,
}: Props) {
  const [repoUrl, setRepoUrl] = useState('')
  const [branch, setBranch] = useState('main')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [needsGitHub, setNeedsGitHub] = useState(false)

  useEffect(() => {
    if (!open) {
      setRepoUrl('')
      setBranch('main')
      setName('')
      setDescription('')
      setError(null)
      setNeedsGitHub(false)
      setSubmitting(false)
    }
  }, [open])

  const canSubmit = useMemo(
    () => repoUrl.trim().length > 0 && branch.trim().length > 0 && !submitting,
    [repoUrl, branch, submitting],
  )

  const handleSubmit = async () => {
    setSubmitting(true)
    setError(null)
    setNeedsGitHub(false)
    try {
      const codebase = await createCodebase(projectId, {
        repository_url: repoUrl.trim(),
        repository_branch: branch.trim(),
        name: name.trim() || null,
        description: description.trim() || null,
      })
      onCreatedAction(codebase)
      onCloseAction()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create codebase.'
      if (message.toLowerCase().includes('github integration not connected')) {
        setNeedsGitHub(true)
      }
      setError(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onClose={onCloseAction} title="Add a codebase" size="md">
      <div className="flex flex-col gap-4">
        {error && (
          <InlineAlert variant="danger">
            {error}
            {needsGitHub && (
              <>
                {' '}
                <Link
                  href={`/projects/${projectId}/integrations?dialog=github`}
                  className="underline"
                >
                  Connect GitHub
                </Link>
              </>
            )}
          </InlineAlert>
        )}

        <FormField label="Repository URL" supportingText="e.g. https://github.com/owner/repo">
          <Input
            type="text"
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            placeholder="https://github.com/owner/repo"
          />
        </FormField>

        <FormField label="Branch">
          <Input
            type="text"
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
            placeholder="main"
          />
        </FormField>

        <FormField label="Name" supportingText="Optional. Defaults to the repo name.">
          <Input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My codebase"
          />
        </FormField>

        <FormField label="Description" supportingText="Optional.">
          <Textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What is this codebase used for?"
          />
        </FormField>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" size="sm" onClick={onCloseAction} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSubmit}
            loading={submitting}
            disabled={!canSubmit}
          >
            <Plug size={14} />
            Add codebase
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
