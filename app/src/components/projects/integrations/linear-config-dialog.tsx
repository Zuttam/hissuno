'use client'

import { useState, useEffect, useCallback } from 'react'
import { Check, Unplug, Shield, KeyRound, Plug, Zap, Save } from 'lucide-react'
import { Dialog, Button, InlineAlert, Spinner, FormField, Input, Select } from '@/components/ui'
import { ToggleGroup } from '@/components/ui/toggle-group'
import type { LinearIntegrationStatus, LinearTeam } from '@/types/linear'
import {
  fetchLinearStatus,
  disconnectLinear,
  updateLinearConfig,
  linearConnectUrl,
  fetchLinearTeams as apiFetchLinearTeams,
  testLinearApiKey,
  connectLinearWithApiKey,
} from '@/lib/api/integrations'

interface LinearConfigDialogProps {
  open: boolean
  onClose: () => void
  projectId: string
  onStatusChanged?: () => void
  /** Whether OAuth env vars are configured on this instance */
  oauthAvailable?: boolean
  /** Human-readable reason when OAuth is unavailable */
  oauthUnavailableReason?: string
}

export function LinearConfigDialog({
  open,
  onClose,
  projectId,
  onStatusChanged,
  oauthAvailable,
  oauthUnavailableReason,
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

  // API Key connection state
  const [connectionMethod, setConnectionMethod] = useState<'oauth' | 'token'>(
    oauthAvailable === false ? 'token' : 'oauth'
  )
  const [apiKey, setApiKey] = useState('')
  const [isConnecting, setIsConnecting] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)

  const fetchStatus = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetchLinearStatus(projectId)
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
      const data = await apiFetchLinearTeams<{ teams: LinearTeam[] }>(projectId)
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
    window.location.href = linearConnectUrl(projectId)
  }

  const handleTestApiKey = async () => {
    if (!apiKey.trim()) return
    setIsTesting(true)
    setTestResult(null)
    try {
      const response = await testLinearApiKey(apiKey.trim())
      const data = await response.json()
      if (response.ok && data.success) {
        setTestResult({ success: true, message: `Connected to ${data.organizationName}` })
      } else {
        setTestResult({ success: false, message: data.error || 'Invalid API key' })
      }
    } catch {
      setTestResult({ success: false, message: 'Failed to test API key' })
    } finally {
      setIsTesting(false)
    }
  }

  const handleConnectWithApiKey = async () => {
    if (!apiKey.trim()) return
    setIsConnecting(true)
    setError(null)
    try {
      const response = await connectLinearWithApiKey({ projectId, apiKey: apiKey.trim() })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Failed to connect')
      }
      setSuccessMessage(`Connected to ${data.organizationName}`)
      setApiKey('')
      setTestResult(null)
      onStatusChanged?.()
      await fetchStatus()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect with API key')
    } finally {
      setIsConnecting(false)
    }
  }

  const handleSaveConfig = async () => {
    if (!selectedTeamId || !selectedTeamName || !selectedTeamKey) {
      setError('Please select a Linear team.')
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      const response = await updateLinearConfig({
        projectId,
        teamId: selectedTeamId,
        teamName: selectedTeamName,
        teamKey: selectedTeamKey,
        autoSyncEnabled,
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
      const response = await updateLinearConfig({
        projectId,
        teamId: selectedTeamId || status?.teamId || '',
        teamName: selectedTeamName || status?.teamName || '',
        teamKey: selectedTeamKey || status?.teamKey || '',
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
      const response = await disconnectLinear(projectId)

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
    <Dialog open={open} onClose={onClose} title="Linear Integration" size="lg">
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
            <p className="flex items-center gap-2 text-sm text-[color:var(--accent-success)]"><Check size={14} />Connected to {status.organizationName}</p>

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
                  <Button variant="secondary" size="sm" onClick={fetchTeams} loading={isLoadingTeams}>
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
                <InlineAlert variant="info">
                  Select a Linear team to complete the setup.
                </InlineAlert>

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
            <div className="border-t border-[color:var(--accent-danger)] pt-4">
              <p className="font-mono text-xs font-medium uppercase tracking-wide text-[color:var(--text-secondary)]">Danger Zone</p>
              <p className="mt-1 text-xs text-[color:var(--text-tertiary)]">
                This will remove the Linear connection. Previously synced issues will remain in Linear.
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
              Connect your Linear workspace to sync issues between Hissuno and Linear.
            </InlineAlert>

            {/* Connection Method Toggle */}
            <ToggleGroup
              value={connectionMethod}
              onChange={setConnectionMethod}
              options={[
                { value: 'oauth' as const, label: 'OAuth', icon: <Shield size={14} /> },
                { value: 'token' as const, label: 'API Key', icon: <KeyRound size={14} /> },
              ]}
            />

            {connectionMethod === 'oauth' ? (
              <div className="space-y-4">
                {oauthAvailable === false ? (
                  <InlineAlert variant="attention">
                    OAuth is not configured on this instance. {oauthUnavailableReason} Use the API Key method instead.
                  </InlineAlert>
                ) : (
                  <>
                    <p className="text-sm text-[color:var(--text-secondary)]">
                      Connect with one click using your Linear account. You&apos;ll be redirected to Linear to authorize access.
                    </p>
                    <Button variant="primary" size="sm" onClick={handleConnect}>
                      <Plug size={14} />
                      Connect with Linear
                    </Button>
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-xs text-[color:var(--text-tertiary)]">
                  Use a personal API key from Linear. Go to Settings &gt; Account &gt; Security &gt; Personal API keys to create one.
                </p>

                <FormField label="API Key">
                  <Input
                    type="password"
                    value={apiKey}
                    onChange={(e) => {
                      setApiKey(e.target.value)
                      setTestResult(null)
                    }}
                    placeholder="lin_api_xxxxx"
                  />
                  {testResult && (
                    <p
                      className={`text-xs ${
                        testResult.success
                          ? 'text-[color:var(--accent-success)]'
                          : 'text-[color:var(--accent-danger)]'
                      }`}
                    >
                      {testResult.message}
                    </p>
                  )}
                </FormField>

                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => void handleTestApiKey()}
                    loading={isTesting}
                    disabled={isTesting || !apiKey.trim()}
                  >
                    <Zap size={14} />
                    Test
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => void handleConnectWithApiKey()}
                    loading={isConnecting}
                    disabled={!apiKey.trim()}
                  >
                    <Plug size={14} />
                    Connect Linear
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

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
      <FormField label="Linear Team">
        <Select
          value={selectedTeamId}
          onChange={onTeamChange}
        >
          <option value="">Select a team...</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.key} - {t.name}
            </option>
          ))}
        </Select>
      </FormField>

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
        size="sm"
        onClick={onSave}
        loading={isSaving}
        disabled={!selectedTeamId}
      >
        <Save size={14} />
        Save
      </Button>
    </div>
  )
}
