'use client'

import { useState, useEffect, useCallback } from 'react'
import { Dialog, Button, Alert, Spinner } from '@/components/ui'
import type { JiraIntegrationStatus, JiraProject, JiraIssueType } from '@/types/jira'

interface JiraConfigDialogProps {
  open: boolean
  onClose: () => void
  projectId: string
  onStatusChanged?: () => void
}

export function JiraConfigDialog({
  open,
  onClose,
  projectId,
  onStatusChanged,
}: JiraConfigDialogProps) {
  const [status, setStatus] = useState<JiraIntegrationStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Configuration state
  const [jiraProjects, setJiraProjects] = useState<JiraProject[]>([])
  const [issueTypes, setIssueTypes] = useState<JiraIssueType[]>([])
  const [selectedProjectKey, setSelectedProjectKey] = useState('')
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [selectedIssueTypeId, setSelectedIssueTypeId] = useState('')
  const [selectedIssueTypeName, setSelectedIssueTypeName] = useState('')
  const [isLoadingProjects, setIsLoadingProjects] = useState(false)
  const [isLoadingIssueTypes, setIsLoadingIssueTypes] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isDisconnecting, setIsDisconnecting] = useState(false)

  const fetchStatus = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/integrations/jira?projectId=${projectId}`)
      if (!response.ok) throw new Error('Failed to load Jira status')
      const data = await response.json()
      setStatus(data)

      // Pre-select existing config
      if (data.jiraProjectKey) {
        setSelectedProjectKey(data.jiraProjectKey)
        setSelectedProjectId(data.jiraProjectId || '')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load Jira status')
    } finally {
      setIsLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    if (open) {
      void fetchStatus()
    }
  }, [open, fetchStatus])

  // Fetch Jira projects when connected but not configured
  const fetchJiraProjects = useCallback(async () => {
    setIsLoadingProjects(true)
    try {
      const response = await fetch(`/api/integrations/jira/projects?projectId=${projectId}`)
      if (!response.ok) throw new Error('Failed to fetch Jira projects')
      const data = await response.json()
      setJiraProjects(data.projects || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch Jira projects')
    } finally {
      setIsLoadingProjects(false)
    }
  }, [projectId])

  // Load projects when connected
  useEffect(() => {
    if (status?.connected && !status.isConfigured) {
      void fetchJiraProjects()
    }
  }, [status, fetchJiraProjects])

  // Fetch issue types when a project is selected
  const handleProjectChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const key = e.target.value
    const selectedProject = jiraProjects.find((p) => p.key === key)
    setSelectedProjectKey(key)
    setSelectedProjectId(selectedProject?.id || '')
    setIssueTypes([])
    setSelectedIssueTypeId('')
    setSelectedIssueTypeName('')

    if (!key) return

    setIsLoadingIssueTypes(true)
    try {
      const response = await fetch(
        `/api/integrations/jira/issue-types?projectId=${projectId}&jiraProjectKey=${key}`
      )
      if (!response.ok) throw new Error('Failed to fetch issue types')
      const data = await response.json()
      setIssueTypes(data.issueTypes || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch issue types')
    } finally {
      setIsLoadingIssueTypes(false)
    }
  }

  const handleIssueTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value
    const selectedType = issueTypes.find((t) => t.id === id)
    setSelectedIssueTypeId(id)
    setSelectedIssueTypeName(selectedType?.name || '')
  }

  const handleConnect = () => {
    window.location.href = `/api/integrations/jira/connect?projectId=${projectId}`
  }

  const handleSaveConfig = async () => {
    if (!selectedProjectKey || !selectedProjectId || !selectedIssueTypeId || !selectedIssueTypeName) {
      setError('Please select both a Jira project and issue type.')
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      const response = await fetch('/api/integrations/jira/configure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          jiraProjectKey: selectedProjectKey,
          jiraProjectId: selectedProjectId,
          issueTypeId: selectedIssueTypeId,
          issueTypeName: selectedIssueTypeName,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to save configuration')
      }

      setSuccessMessage('Jira integration configured. New issues will be synced automatically.')
      onStatusChanged?.()
      await fetchStatus()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save configuration')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDisconnect = async () => {
    setIsDisconnecting(true)
    setError(null)

    try {
      const response = await fetch(`/api/integrations/jira?projectId=${projectId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to disconnect Jira')
      }

      setStatus(null)
      setJiraProjects([])
      setIssueTypes([])
      setSelectedProjectKey('')
      setSelectedProjectId('')
      setSelectedIssueTypeId('')
      setSelectedIssueTypeName('')
      onStatusChanged?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect Jira')
    } finally {
      setIsDisconnecting(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Jira Integration" size="2xl">
      <div className="flex flex-col gap-6">
        {error && (
          <div className="rounded-[4px] border-2 border-[color:var(--accent-danger)] bg-transparent p-3 font-mono text-sm text-[color:var(--accent-danger)]">
            {error}
          </div>
        )}

        {successMessage && (
          <Alert variant="success">{successMessage}</Alert>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Spinner size="md" />
          </div>
        ) : status?.connected ? (
          <div className="space-y-6">
            <Alert variant="success">
              Connected to: <strong>{status.siteUrl}</strong>
            </Alert>

            {status.isConfigured ? (
              // Fully configured state
              <div className="space-y-4">
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-[color:var(--foreground)]">
                    Configuration
                  </h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-[color:var(--text-secondary)]">Jira Project:</span>{' '}
                      <span className="font-medium">{status.jiraProjectKey}</span>
                    </div>
                    <div>
                      <span className="text-[color:var(--text-secondary)]">Issue Type:</span>{' '}
                      <span className="font-medium">{status.issueTypeName}</span>
                    </div>
                  </div>
                </div>

                <div className="rounded-[4px] border border-[color:var(--border-subtle)] bg-[color:var(--surface)] p-3">
                  <p className="text-sm text-[color:var(--text-secondary)]">
                    New issues created in Hissuno will automatically be synced to Jira as{' '}
                    <strong>{status.issueTypeName}</strong> tickets in the{' '}
                    <strong>{status.jiraProjectKey}</strong> project.
                  </p>
                </div>

                {/* Reconfigure */}
                <div className="space-y-2 border-t border-[color:var(--border-subtle)] pt-4">
                  <Button variant="secondary" onClick={fetchJiraProjects} loading={isLoadingProjects}>
                    Change Configuration
                  </Button>
                </div>

                {jiraProjects.length > 0 && (
                  <ConfigurationForm
                    jiraProjects={jiraProjects}
                    issueTypes={issueTypes}
                    selectedProjectKey={selectedProjectKey}
                    selectedIssueTypeId={selectedIssueTypeId}
                    isLoadingIssueTypes={isLoadingIssueTypes}
                    isSaving={isSaving}
                    onProjectChange={handleProjectChange}
                    onIssueTypeChange={handleIssueTypeChange}
                    onSave={handleSaveConfig}
                  />
                )}
              </div>
            ) : (
              // Connected but not configured
              <div className="space-y-4">
                <Alert variant="info">
                  Select a Jira project and issue type to complete the setup.
                </Alert>

                {isLoadingProjects ? (
                  <div className="flex items-center justify-center py-4">
                    <Spinner size="sm" />
                    <span className="ml-2 text-sm text-[color:var(--text-secondary)]">
                      Loading Jira projects...
                    </span>
                  </div>
                ) : (
                  <ConfigurationForm
                    jiraProjects={jiraProjects}
                    issueTypes={issueTypes}
                    selectedProjectKey={selectedProjectKey}
                    selectedIssueTypeId={selectedIssueTypeId}
                    isLoadingIssueTypes={isLoadingIssueTypes}
                    isSaving={isSaving}
                    onProjectChange={handleProjectChange}
                    onIssueTypeChange={handleIssueTypeChange}
                    onSave={handleSaveConfig}
                  />
                )}
              </div>
            )}

            {/* Danger Zone */}
            <div className="space-y-2 pt-2 border-t border-[color:var(--border-subtle)]">
              <h4 className="text-xs font-medium text-[color:var(--accent-danger)]">
                Danger Zone
              </h4>
              <Button variant="danger" onClick={handleDisconnect} loading={isDisconnecting}>
                Disconnect
              </Button>
              <p className="text-xs text-[color:var(--text-tertiary)]">
                This will remove the Jira connection. Previously synced tickets will remain in Jira.
              </p>
            </div>
          </div>
        ) : (
          // Not connected state
          <div className="space-y-6">
            <Alert variant="info">
              Connect your Jira Cloud workspace to automatically create Jira tickets when
              issues are discovered in Hissuno.
            </Alert>

            <div className="space-y-4">
              <div className="rounded-[4px] border border-[color:var(--border-subtle)] bg-[color:var(--surface)] p-4">
                <h4 className="mb-2 text-sm font-medium text-[color:var(--foreground)]">
                  What happens when you connect:
                </h4>
                <ul className="space-y-1 text-sm text-[color:var(--text-secondary)]">
                  <li>1. New issues in Hissuno create Jira tickets automatically</li>
                  <li>2. Product specs are linked as comments on Jira tickets</li>
                  <li>3. Jira status changes sync back to Hissuno</li>
                </ul>
              </div>

              <Button variant="primary" onClick={handleConnect}>
                Connect Jira
              </Button>

              <p className="text-xs text-[color:var(--text-tertiary)]">
                You will be redirected to Atlassian to authorize Hissuno.
                Requires a Jira Cloud account.
              </p>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end border-t border-[color:var(--border-subtle)] pt-4">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Dialog>
  )
}

// ============================================================================
// Configuration Form Component
// ============================================================================

interface ConfigurationFormProps {
  jiraProjects: JiraProject[]
  issueTypes: JiraIssueType[]
  selectedProjectKey: string
  selectedIssueTypeId: string
  isLoadingIssueTypes: boolean
  isSaving: boolean
  onProjectChange: (e: React.ChangeEvent<HTMLSelectElement>) => void
  onIssueTypeChange: (e: React.ChangeEvent<HTMLSelectElement>) => void
  onSave: () => void
}

function ConfigurationForm({
  jiraProjects,
  issueTypes,
  selectedProjectKey,
  selectedIssueTypeId,
  isLoadingIssueTypes,
  isSaving,
  onProjectChange,
  onIssueTypeChange,
  onSave,
}: ConfigurationFormProps) {
  return (
    <div className="space-y-4">
      {/* Jira Project Selector */}
      <div className="space-y-1">
        <label className="text-sm font-medium text-[color:var(--foreground)]">
          Jira Project
        </label>
        <select
          value={selectedProjectKey}
          onChange={onProjectChange}
          className="w-full rounded-[4px] border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[color:var(--accent-selected)]"
        >
          <option value="">Select a project...</option>
          {jiraProjects.map((p) => (
            <option key={p.key} value={p.key}>
              {p.key} - {p.name}
            </option>
          ))}
        </select>
      </div>

      {/* Issue Type Selector */}
      <div className="space-y-1">
        <label className="text-sm font-medium text-[color:var(--foreground)]">
          Default Issue Type
        </label>
        {isLoadingIssueTypes ? (
          <div className="flex items-center gap-2 py-2">
            <Spinner size="sm" />
            <span className="text-sm text-[color:var(--text-secondary)]">
              Loading issue types...
            </span>
          </div>
        ) : (
          <select
            value={selectedIssueTypeId}
            onChange={onIssueTypeChange}
            disabled={!selectedProjectKey || issueTypes.length === 0}
            className="w-full rounded-[4px] border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[color:var(--accent-selected)] disabled:opacity-50"
          >
            <option value="">Select an issue type...</option>
            {issueTypes
              .filter((t) => !t.subtask)
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
          </select>
        )}
      </div>

      <Button
        variant="primary"
        onClick={onSave}
        loading={isSaving}
        disabled={!selectedProjectKey || !selectedIssueTypeId}
      >
        Save Configuration
      </Button>
    </div>
  )
}
