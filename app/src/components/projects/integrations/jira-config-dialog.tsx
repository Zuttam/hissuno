'use client'

import { useState, useEffect, useCallback } from 'react'
import { Check, Unplug, Plug, Save } from 'lucide-react'
import { Dialog, Button, InlineAlert, Spinner, FormField, Select } from '@/components/ui'
import type { JiraIntegrationStatus, JiraProject, JiraIssueType } from '@/types/jira'
import {
  fetchJiraStatus as apiFetchJiraStatus,
  disconnectJira,
  jiraConnectUrl,
  fetchJiraProjects as apiFetchJiraProjects,
  fetchJiraIssueTypes as apiFetchJiraIssueTypes,
  configureJira,
} from '@/lib/api/integrations'

interface JiraConfigDialogProps {
  open: boolean
  onClose: () => void
  projectId: string
  onStatusChanged?: () => void
  /** Whether OAuth env vars are configured on this instance */
  oauthAvailable?: boolean
  /** Human-readable reason when OAuth is unavailable */
  oauthUnavailableReason?: string
}

export function JiraConfigDialog({
  open,
  onClose,
  projectId,
  onStatusChanged,
  oauthAvailable,
  oauthUnavailableReason,
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
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(true)
  const [isLoadingProjects, setIsLoadingProjects] = useState(false)
  const [isLoadingIssueTypes, setIsLoadingIssueTypes] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isDisconnecting, setIsDisconnecting] = useState(false)

  const fetchStatus = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await apiFetchJiraStatus(projectId)
      if (!response.ok) throw new Error('Failed to load Jira status')
      const data = await response.json()
      setStatus(data)

      // Pre-select existing config
      if (data.jiraProjectKey) {
        setSelectedProjectKey(data.jiraProjectKey)
        setSelectedProjectId(data.jiraProjectId || '')
      }
      setAutoSyncEnabled(data.autoSyncEnabled !== false)
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
      const data = await apiFetchJiraProjects<{ projects: JiraProject[] }>(projectId)
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
      const data = await apiFetchJiraIssueTypes<{ issueTypes: JiraIssueType[] }>(projectId, key)
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
    window.location.href = jiraConnectUrl(projectId)
  }

  const handleSaveConfig = async () => {
    if (!selectedProjectKey || !selectedProjectId || !selectedIssueTypeId || !selectedIssueTypeName) {
      setError('Please select both a Jira project and issue type.')
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      const response = await configureJira({
        projectId,
        jiraProjectKey: selectedProjectKey,
        jiraProjectId: selectedProjectId,
        issueTypeId: selectedIssueTypeId,
        issueTypeName: selectedIssueTypeName,
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

  const handleUpdateAutoSync = async () => {
    if (!status?.jiraProjectKey || !status?.jiraProjectId || !status?.issueTypeName) return
    setIsSaving(true)
    setError(null)

    try {
      const newAutoSync = !autoSyncEnabled
      const response = await configureJira({
        projectId,
        jiraProjectKey: selectedProjectKey || status.jiraProjectKey,
        jiraProjectId: selectedProjectId || status.jiraProjectId,
        issueTypeId: selectedIssueTypeId || status.issueTypeName,
        issueTypeName: selectedIssueTypeName || status.issueTypeName,
        autoSyncEnabled: newAutoSync,
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to update configuration')
      }

      setAutoSyncEnabled(newAutoSync)
      onStatusChanged?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update configuration')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDisconnect = async () => {
    setIsDisconnecting(true)
    setError(null)

    try {
      const response = await disconnectJira(projectId)

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
    <Dialog open={open} onClose={onClose} title="Jira Integration" size="lg">
      <div className="flex flex-col gap-6">
        {error && <InlineAlert variant="danger">{error}</InlineAlert>}

        {successMessage && (
          <InlineAlert variant="success">{successMessage}</InlineAlert>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Spinner size="md" />
          </div>
        ) : status?.connected ? (
          <div className="space-y-6">
            <p className="flex items-center gap-2 text-sm text-[color:var(--accent-success)]"><Check size={14} />Connected to {status.siteUrl}</p>

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
                    <div>
                      <span className="text-[color:var(--text-secondary)]">Auto-sync:</span>{' '}
                      <span className="font-medium">{autoSyncEnabled ? 'Enabled' : 'Disabled'}</span>
                    </div>
                  </div>
                </div>

                <div className="rounded-[4px] border border-[color:var(--border-subtle)] bg-[color:var(--surface)] p-3">
                  <p className="text-sm text-[color:var(--text-secondary)]">
                    {autoSyncEnabled
                      ? <>New issues created in Hissuno will automatically be synced to Jira as{' '}
                        <strong>{status.issueTypeName}</strong> tickets in the{' '}
                        <strong>{status.jiraProjectKey}</strong> project.</>
                      : <>Auto-sync is disabled. Use &ldquo;Send to Jira&rdquo; on individual issues to sync manually.</>
                    }
                  </p>
                </div>

                {/* Auto-sync toggle */}
                <div className="flex items-center gap-3">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => void handleUpdateAutoSync()}
                    loading={isSaving}
                  >
                    {autoSyncEnabled ? 'Disable Auto-Sync' : 'Enable Auto-Sync'}
                  </Button>
                </div>

                {/* Reconfigure */}
                <div className="space-y-2 border-t border-[color:var(--border-subtle)] pt-4">
                  <Button variant="secondary" size="sm" onClick={fetchJiraProjects} loading={isLoadingProjects}>
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
                <InlineAlert variant="info">
                  Select a Jira project and issue type to complete the setup.
                </InlineAlert>

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
            <div className="border-t border-[color:var(--accent-danger)] pt-4">
              <p className="font-mono text-xs font-medium uppercase tracking-wide text-[color:var(--text-secondary)]">Danger Zone</p>
              <p className="mt-1 text-xs text-[color:var(--text-tertiary)]">
                This will remove the Jira connection. Previously synced tickets will remain in Jira.
              </p>
              <Button
                variant="danger"
                size="sm"
                className="mt-3"
                onClick={handleDisconnect}
                disabled={isDisconnecting}
                loading={isDisconnecting}
              >
                <Unplug size={14} />
                Disconnect
              </Button>
            </div>
          </div>
        ) : (
          // Not connected state
          <div className="space-y-6">
            <InlineAlert variant="info">
              Connect your Jira Cloud workspace to automatically create Jira tickets when
              issues are discovered in Hissuno.
            </InlineAlert>

            <div className="space-y-4">
              {oauthAvailable === false ? (
                <InlineAlert variant="attention">
                  OAuth is not configured on this instance. {oauthUnavailableReason}
                </InlineAlert>
              ) : (
                <>
                  <Button variant="primary" size="sm" onClick={handleConnect}>
                    <Plug size={14} />
                    Connect Jira
                  </Button>

                  <p className="text-xs text-[color:var(--text-tertiary)]">
                    You will be redirected to Atlassian to authorize Hissuno.
                    Requires a Jira Cloud account.
                  </p>
                </>
              )}
            </div>
          </div>
        )}

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
      <FormField label="Jira Project">
        <Select
          value={selectedProjectKey}
          onChange={onProjectChange}
        >
          <option value="">Select a project...</option>
          {jiraProjects.map((p) => (
            <option key={p.key} value={p.key}>
              {p.key} - {p.name}
            </option>
          ))}
        </Select>
      </FormField>

      {/* Issue Type Selector */}
      <FormField label="Default Issue Type">
        {isLoadingIssueTypes ? (
          <div className="flex items-center gap-2 py-2">
            <Spinner size="sm" />
            <span className="text-sm text-[color:var(--text-secondary)]">
              Loading issue types...
            </span>
          </div>
        ) : (
          <Select
            value={selectedIssueTypeId}
            onChange={onIssueTypeChange}
            disabled={!selectedProjectKey || issueTypes.length === 0}
          >
            <option value="">Select an issue type...</option>
            {issueTypes
              .filter((t) => !t.subtask)
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
          </Select>
        )}
      </FormField>

      <Button
        variant="primary"
        size="sm"
        onClick={onSave}
        loading={isSaving}
        disabled={!selectedProjectKey || !selectedIssueTypeId}
      >
        <Save size={14} />
        Save
      </Button>
    </div>
  )
}
