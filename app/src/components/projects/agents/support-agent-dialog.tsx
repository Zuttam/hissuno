'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Dialog, Button, Select, Alert, IconButton, PlusIcon, Input, Textarea } from '@/components/ui'
import { updateSupportAgentSettings } from '@/lib/api/settings'
import { PackageList } from '@/components/projects/knowledge/package-list'
import { PackageDialog } from '@/components/projects/knowledge/package-dialog'
import type { SupportPackageWithSources } from '@/lib/knowledge/types'
import type { IntegrationStatuses } from '@/hooks/use-integration-statuses'

type PackageView =
  | null
  | { mode: 'create' }
  | { mode: 'edit'; pkg: SupportPackageWithSources }

function ChannelStatus({ connected }: { connected: boolean }) {
  return (
    <span
      className={`inline-block h-2 w-2 rounded-full ${connected ? 'bg-[color:var(--accent-success)]' : 'bg-[color:var(--text-tertiary)]'}`}
    />
  )
}

interface SupportAgentDialogProps {
  open: boolean
  onClose: () => void
  projectId: string
  integrationStatuses: IntegrationStatuses
  initialSettings: {
    toneOfVoice: string
    brandGuidelines: string
    packageId: string | null
    sessionIdleTimeoutMinutes: number
    sessionGoodbyeDelaySeconds: number
    sessionIdleResponseTimeoutSeconds: number
    memoryEnabled: boolean
  }
  onSaved: () => void
  onOpenTestAgent: () => void
  onPackagesChange: () => void
}

export function SupportAgentDialog({
  open,
  onClose,
  projectId,
  integrationStatuses,
  initialSettings,
  onSaved,
  onOpenTestAgent,
  onPackagesChange,
}: SupportAgentDialogProps) {
  const [toneOfVoice, setToneOfVoice] = useState(initialSettings.toneOfVoice)
  const [brandGuidelines, setBrandGuidelines] = useState(initialSettings.brandGuidelines)
  const [packageId, setPackageId] = useState(initialSettings.packageId)
  const [idleTimeout, setIdleTimeout] = useState(initialSettings.sessionIdleTimeoutMinutes)
  const [goodbyeDelay, setGoodbyeDelay] = useState(initialSettings.sessionGoodbyeDelaySeconds)
  const [responseTimeout, setResponseTimeout] = useState(initialSettings.sessionIdleResponseTimeoutSeconds)
  const [memoryEnabled, setMemoryEnabled] = useState(initialSettings.memoryEnabled)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [packageView, setPackageView] = useState<PackageView>(null)

  // Reset form when dialog opens with new settings
  useEffect(() => {
    if (open) {
      setToneOfVoice(initialSettings.toneOfVoice)
      setBrandGuidelines(initialSettings.brandGuidelines)
      setPackageId(initialSettings.packageId)
      setIdleTimeout(initialSettings.sessionIdleTimeoutMinutes)
      setGoodbyeDelay(initialSettings.sessionGoodbyeDelaySeconds)
      setResponseTimeout(initialSettings.sessionIdleResponseTimeoutSeconds)
      setMemoryEnabled(initialSettings.memoryEnabled)
      setError(null)
      setPackageView(null)
    }
  }, [open, initialSettings])

  const handleSave = async () => {
    setIsSaving(true)
    setError(null)

    try {
      await updateSupportAgentSettings(projectId, {
        support_agent_package_id: packageId,
        support_agent_tone: toneOfVoice,
        brand_guidelines: brandGuidelines,
        session_idle_timeout_minutes: idleTimeout,
        session_goodbye_delay_seconds: goodbyeDelay,
        session_idle_response_timeout_seconds: responseTimeout,
        support_agent_memory_enabled: memoryEnabled,
      })

      onSaved()
      onClose()
    } catch {
      setError('Failed to save settings. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  const handlePackageSaved = () => {
    onPackagesChange()
    setPackageView(null)
  }

  const handlePackageDeleted = () => {
    onPackagesChange()
    setPackageView(null)
  }

  const dialogTitle = packageView
    ? packageView.mode === 'create'
      ? 'Create Package'
      : 'Package Settings'
    : 'Customer Agent'

  return (
    <Dialog open={open} onClose={onClose} title={dialogTitle} size="xxl">
      {packageView ? (
        <div className="flex flex-col gap-4">
          <div>
            <Button
              variant="link"
              size="sm"
              onClick={() => setPackageView(null)}
            >
              &larr; Back
            </Button>
          </div>
          <PackageDialog
            projectId={projectId}
            package={packageView.mode === 'edit' ? packageView.pkg : undefined}
            open
            onClose={() => setPackageView(null)}
            onSaved={handlePackageSaved}
            onDeleted={handlePackageDeleted}
            embedded
          />
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {error && (
            <Alert variant="warning">{error}</Alert>
          )}

          <div className="flex flex-col gap-8">
            <div className="flex justify-end">
              <Button
                variant="secondary"
                size="md"
                onClick={() => {
                  onOpenTestAgent()
                  onClose()
                }}
              >
                Test Agent
              </Button>
            </div>

            {/* Interactive Channels */}
            <div className="flex flex-col gap-3">
              <label className="block font-mono text-xs font-semibold uppercase text-[color:var(--text-secondary)]">
                Interactive Channels
              </label>
              <div className="flex flex-col gap-2">
                <Link
                  href={`/projects/${projectId}/integrations?dialog=widget`}
                  className="flex items-center gap-3 rounded-[4px] border border-[color:var(--border-subtle)] p-3 hover:bg-[color:var(--surface-hover)] transition-colors"
                  onClick={onClose}
                >
                  <ChannelStatus connected={integrationStatuses.widget} />
                  <svg className="h-5 w-5 text-[color:var(--foreground)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                  <span className="text-sm font-medium text-[color:var(--foreground)]">Widget</span>
                  <span className="ml-auto text-xs text-[color:var(--text-tertiary)]">
                    {integrationStatuses.widget ? 'Connected' : 'Not connected'}
                  </span>
                </Link>
                <Link
                  href={`/projects/${projectId}/integrations?dialog=slack`}
                  className="flex items-center gap-3 rounded-[4px] border border-[color:var(--border-subtle)] p-3 hover:bg-[color:var(--surface-hover)] transition-colors"
                  onClick={onClose}
                >
                  <ChannelStatus connected={integrationStatuses.slack} />
                  <img src="/logos/slack.svg" alt="Slack" width={20} height={20} />
                  <span className="text-sm font-medium text-[color:var(--foreground)]">Slack</span>
                  <span className="ml-auto text-xs text-[color:var(--text-tertiary)]">
                    {integrationStatuses.slack ? 'Connected' : 'Not connected'}
                  </span>
                </Link>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block font-mono text-xs font-semibold uppercase text-[color:var(--text-secondary)]">
                  Scoped knowledge used by the Agent
                </label>
                <IconButton
                  variant="ghost"
                  size="sm"
                  aria-label="Create new package"
                  title="Create new package"
                  onClick={() => setPackageView({ mode: 'create' })}
                >
                  <PlusIcon className="h-4 w-4" />
                </IconButton>
              </div>
              <PackageList
                projectId={projectId}
                activePackageId={packageId}
                onPackageSelect={(id) => setPackageId(id)}
                onPackagesChange={onPackagesChange}
                onCreatePackage={() => setPackageView({ mode: 'create' })}
                onEditPackage={(pkg) => setPackageView({ mode: 'edit', pkg })}
                hasResources
              />
            </div>
            <div>
              <label className="block font-mono text-xs font-semibold uppercase text-[color:var(--text-secondary)] mb-2">
                Tone of Voice
              </label>
              <Select
                value={toneOfVoice}
                onChange={(e) => setToneOfVoice(e.target.value)}
              >
                <option value="professional">Professional</option>
                <option value="friendly">Friendly</option>
                <option value="technical">Technical</option>
                <option value="casual">Casual</option>
              </Select>
            </div>
            <div>
              <label className="block font-mono text-xs font-semibold uppercase text-[color:var(--text-secondary)] mb-2">
                Brand Guidelines
              </label>
              <Textarea
                value={brandGuidelines}
                onChange={(e) => setBrandGuidelines(e.target.value)}
                placeholder="Enter any brand-specific guidelines, terminology, or style instructions..."
                rows={3}
              />
            </div>

            {/* Memory */}
            <div className="flex flex-col gap-3">
              <label className="block font-mono text-xs font-semibold uppercase text-[color:var(--text-secondary)]">
                Memory
              </label>
              <div className="flex items-center justify-between rounded-lg border border-[color:var(--border-subtle)] px-4 py-3">
                <div>
                  <span className="text-sm font-medium text-[color:var(--foreground)]">Enable memory</span>
                  <p className="text-xs text-[color:var(--text-tertiary)] mt-0.5">
                    Remember context across this contact's sessions so they can pick up where they left off.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={memoryEnabled}
                  onClick={() => setMemoryEnabled((v) => !v)}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[color:var(--accent-primary)] focus:ring-offset-2 ${
                    memoryEnabled ? 'bg-[color:var(--accent-primary)]' : 'bg-[color:var(--surface-hover)]'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      memoryEnabled ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Session Lifecycle */}
            <div className="flex flex-col gap-3">
              <label className="block font-mono text-xs font-semibold uppercase text-[color:var(--text-secondary)]">
                Session Lifecycle
              </label>
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-[color:var(--foreground)]">Idle Timeout</div>
                    <div className="text-xs text-[color:var(--text-secondary)]">Minutes before session is considered idle (1-60)</div>
                  </div>
                  <Input
                    type="number"
                    min={1}
                    max={60}
                    value={idleTimeout}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10)
                      if (!isNaN(v)) setIdleTimeout(Math.min(60, Math.max(1, v)))
                    }}
                    className="w-20 text-right"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-[color:var(--foreground)]">Goodbye Delay</div>
                    <div className="text-xs text-[color:var(--text-secondary)]">Seconds after goodbye before closing (0-300)</div>
                  </div>
                  <Input
                    type="number"
                    min={0}
                    max={300}
                    value={goodbyeDelay}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10)
                      if (!isNaN(v)) setGoodbyeDelay(Math.min(300, Math.max(0, v)))
                    }}
                    className="w-20 text-right"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-[color:var(--foreground)]">Response Timeout</div>
                    <div className="text-xs text-[color:var(--text-secondary)]">Seconds to wait for user response (10-300)</div>
                  </div>
                  <Input
                    type="number"
                    min={10}
                    max={300}
                    value={responseTimeout}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10)
                      if (!isNaN(v)) setResponseTimeout(Math.min(300, Math.max(10, v)))
                    }}
                    className="w-20 text-right"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 border-t border-[color:var(--border-subtle)] pt-4">
            <Button variant="secondary" onClick={onClose} disabled={isSaving}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSave} loading={isSaving} disabled={isSaving}>
              Save
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  )
}
