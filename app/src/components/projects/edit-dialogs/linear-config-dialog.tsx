'use client'

import { useState, useEffect, useCallback } from 'react'
import { Dialog, Button, Alert, Spinner } from '@/components/ui'
import type { LinearIntegrationStatus, LinearTeam } from '@/types/linear'

interface LinearConfigDialogProps {
  open: boolean
  onClose: () => void
  projectId: string
  onStatusChanged?: () => void
}

export function LinearConfigDialog({
  open,
  onClose,
  projectId,
  onStatusChanged,
}: LinearConfigDialogProps) {
  const [status, setStatus] = useState<LinearIntegrationStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Configuration state
  const [teams, setTeams] = useState<LinearTeam[]>([])
  const [selectedTeamId, setSelectedTeamId] = useState('')
  const [selectedTeamName, setSelectedTeamName] = useState('')
  const [selectedTeamKey, setSelectedTeamKey] = useState('')
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(true)
  const [isLoadingTeams, setIsLoadingTeams] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isDisconnecting, setIsDisconnecting] = useState(false)

  const fetchStatus = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/integrations/linear?projectId=${projectId}`)
      if (!response.ok) throw new Error('Failed to load Linear status')
      const data = await response.json()
      setStatus(data)

      // Pre-select existing config
      if (data.teamId) {
        setSelectedTeamId(data.teamId)
        setSelectedTeamName(data.teamName || '')
        setSelectedTeamKey(data.teamKey || '')
      }
      setAutoSyncEnabled(data.autoSyncEnabled !== false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load Linear status')
    } finally {
      setIsLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    if (open) {
      void fetchStatus()
    }
  }, [open, fetchStatus])

  // Fetch Linear teams when connected but not configured
  const fetchTeams = useCallback(async () => {
    setIsLoadingTeams(true)
    try {
      const response = await fetch(`/api/integrations/linear/teams?projectId=${projectId}`)
      if (!response.ok) throw new Error('Failed to fetch Linear teams')
      const data = await response.json()
      setTeams(data.teams || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch Linear teams')
    } finally {
      setIsLoadingTeams(false)
    }
  }, [projectId])

  // Load teams when connected
  useEffect(() => {
    if (status?.connected && !status.isConfigured) {
      void fetchTeams()
    }
  }, [status, fetchTeams])

  const handleTeamChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const teamId = e.target.value
    const team = teams.find((t) => t.id === teamId)
    setSelectedTeamId(teamId)
    setSelectedTeamName(team?.name || '')
    setSelectedTeamKey(team?.key || '')
  }

  const handleConnect = () => {
    window.location.href = `/api/integrations/linear/connect?projectId=${projectId}`
  }

  const handleSaveConfig = async () => {
    if (!selectedTeamId || !selectedTeamName || !selectedTeamKey) {
      setError('Please select a Linear team.')
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      const response = await fetch('/api/integrations/linear', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          teamId: selectedTeamId,
          teamName: selectedTeamName,
          teamKey: selectedTeamKey,
          autoSyncEnabled,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to save configuration')
      }

      setSuccessMessage('Linear integration configured successfully.')
      onStatusChanged?.()
      await fetchStatus()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save configuration')
    } finally {
      setIsSaving(false)
    }
  }

  const handleUpdateAutoSync = async () => {
    setIsSaving(true)
    setError(null)

    try {
      const newAutoSync = !autoSyncEnabled
      const response = await fetch('/api/integrations/linear', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          teamId: selectedTeamId || status?.teamId,
          teamName: selectedTeamName || status?.teamName,
          teamKey: selectedTeamKey || status?.teamKey,
          autoSyncEnabled: newAutoSync,
        }),
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
      const response = await fetch(`/api/integrations/linear?projectId=${projectId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to disconnect Linear')
      }

      setStatus(null)
      setTeams([])
      setSelectedTeamId('')
      setSelectedTeamName('')
      setSelectedTeamKey('')
      onStatusChanged?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect Linear')
    } finally {
      setIsDisconnecting(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Linear Integration" size="xxl">
      <div className="flex flex-col gap-6">
        {error && <Alert variant="danger">{error}</Alert>}

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
              Connected to: <strong>{status.organizationName}</strong>
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
                      <span className="text-[color:var(--text-secondary)]">Team:</span>{' '}
                      <span className="font-medium">{status.teamKey} - {status.teamName}</span>
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
                      ? <>New issues created in Hissuno will automatically be synced to the <strong>{status.teamKey}</strong> team in Linear.</>
                      : <>Auto-sync is disabled. Use &ldquo;Send to Linear&rdquo; on individual issues to sync manually.</>
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
                  <Button variant="secondary" onClick={fetchTeams} loading={isLoadingTeams}>
                    Change Team
                  </Button>
                </div>

                {teams.length > 0 && (
                  <TeamConfigurationForm
                    teams={teams}
                    selectedTeamId={selectedTeamId}
                    autoSyncEnabled={autoSyncEnabled}
                    isSaving={isSaving}
                    onTeamChange={handleTeamChange}
                    onAutoSyncChange={setAutoSyncEnabled}
                    onSave={handleSaveConfig}
                  />
                )}
              </div>
            ) : (
              // Connected but not configured
              <div className="space-y-4">
                <Alert variant="info">
                  Select a Linear team to complete the setup.
                </Alert>

                {isLoadingTeams ? (
                  <div className="flex items-center justify-center py-4">
                    <Spinner size="sm" />
                    <span className="ml-2 text-sm text-[color:var(--text-secondary)]">
                      Loading Linear teams...
                    </span>
                  </div>
                ) : (
                  <TeamConfigurationForm
                    teams={teams}
                    selectedTeamId={selectedTeamId}
                    autoSyncEnabled={autoSyncEnabled}
                    isSaving={isSaving}
                    onTeamChange={handleTeamChange}
                    onAutoSyncChange={setAutoSyncEnabled}
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
                This will remove the Linear connection. Previously synced issues will remain in Linear.
              </p>
            </div>
          </div>
        ) : (
          // Not connected state
          <div className="space-y-6">
            <Alert variant="info">
              Connect your Linear workspace to sync issues between Hissuno and Linear.
            </Alert>

            <div className="space-y-4">
              <div className="rounded-[4px] border border-[color:var(--border-subtle)] bg-[color:var(--surface)] p-4">
                <h4 className="mb-2 text-sm font-medium text-[color:var(--foreground)]">
                  What happens when you connect:
                </h4>
                <ul className="space-y-1 text-sm text-[color:var(--text-secondary)]">
                  <li>1. New issues in Hissuno create Linear issues automatically</li>
                  <li>2. Product specs are linked as comments on Linear issues</li>
                  <li>3. Linear status changes sync back to Hissuno</li>
                </ul>
              </div>

              <Button variant="primary" onClick={handleConnect}>
                Connect Linear
              </Button>

              <p className="text-xs text-[color:var(--text-tertiary)]">
                You will be redirected to Linear to authorize Hissuno.
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
// Team Configuration Form
// ============================================================================

interface TeamConfigurationFormProps {
  teams: LinearTeam[]
  selectedTeamId: string
  autoSyncEnabled: boolean
  isSaving: boolean
  onTeamChange: (e: React.ChangeEvent<HTMLSelectElement>) => void
  onAutoSyncChange: (enabled: boolean) => void
  onSave: () => void
}

function TeamConfigurationForm({
  teams,
  selectedTeamId,
  autoSyncEnabled,
  isSaving,
  onTeamChange,
  onAutoSyncChange,
  onSave,
}: TeamConfigurationFormProps) {
  return (
    <div className="space-y-4">
      {/* Team Selector */}
      <div className="space-y-1">
        <label className="text-sm font-medium text-[color:var(--foreground)]">
          Linear Team
        </label>
        <select
          value={selectedTeamId}
          onChange={onTeamChange}
          className="w-full rounded-[4px] border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[color:var(--accent-selected)]"
        >
          <option value="">Select a team...</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.key} - {t.name}
            </option>
          ))}
        </select>
      </div>

      {/* Auto-sync toggle */}
      <div className="space-y-1">
        <label className="flex items-center gap-2 text-sm font-medium text-[color:var(--foreground)] cursor-pointer">
          <input
            type="checkbox"
            checked={autoSyncEnabled}
            onChange={(e) => onAutoSyncChange(e.target.checked)}
            className="rounded border-[color:var(--border)]"
          />
          Auto-sync new issues
        </label>
        <p className="text-xs text-[color:var(--text-tertiary)] ml-6">
          When enabled, new issues created in Hissuno will automatically be synced to Linear.
        </p>
      </div>

      <Button
        variant="primary"
        onClick={onSave}
        loading={isSaving}
        disabled={!selectedTeamId}
      >
        Save Configuration
      </Button>
    </div>
  )
}
