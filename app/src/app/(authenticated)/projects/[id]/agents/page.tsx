'use client'

import { useState, useEffect, useCallback } from 'react'
import { useProject } from '@/components/providers/project-provider'
import { TestAgentDialog } from '@/components/projects/test-agent-dialog'
import { FloatingCard } from '@/components/ui/floating-card'
import { Button, Heading, Alert, Spinner, Input, Select, PageHeader } from '@/components/ui'

interface AgentSettings {
  supportAgent: {
    toneOfVoice: string
    brandGuidelines: string
  }
  pmAgent: {
    classificationGuidelines: string
    specGuidelines: string
    autoSpecThreshold: number
  }
}

export default function AgentsPage() {
  const { project, projectId, isLoading: isLoadingProject } = useProject()
  const [showTestAgent, setShowTestAgent] = useState(false)
  const [settings, setSettings] = useState<AgentSettings>({
    supportAgent: {
      toneOfVoice: 'professional',
      brandGuidelines: '',
    },
    pmAgent: {
      classificationGuidelines: '',
      specGuidelines: '',
      autoSpecThreshold: 3,
    },
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Fetch project settings on mount
  useEffect(() => {
    if (!projectId) return

    const fetchSettings = async () => {
      try {
        const response = await fetch(`/api/projects/${projectId}/settings`)
        if (response.ok) {
          const data = await response.json()
          if (data.settings) {
            setSettings({
              supportAgent: {
                toneOfVoice: data.settings.support_agent_tone ?? 'professional',
                brandGuidelines: data.settings.brand_guidelines ?? '',
              },
              pmAgent: {
                classificationGuidelines: data.settings.classification_guidelines ?? '',
                specGuidelines: data.settings.spec_guidelines ?? '',
                autoSpecThreshold: data.settings.auto_spec_threshold ?? 3,
              },
            })
          }
        }
      } catch (err) {
        console.error('[agents] Failed to fetch settings:', err)
      } finally {
        setIsLoading(false)
      }
    }

    void fetchSettings()
  }, [projectId])

  const handleSave = useCallback(async () => {
    if (!projectId) return

    setIsSaving(true)
    setError(null)
    setSuccessMessage(null)

    try {
      const response = await fetch(`/api/projects/${projectId}/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          support_agent_tone: settings.supportAgent.toneOfVoice,
          brand_guidelines: settings.supportAgent.brandGuidelines,
          classification_guidelines: settings.pmAgent.classificationGuidelines,
          spec_guidelines: settings.pmAgent.specGuidelines,
          auto_spec_threshold: settings.pmAgent.autoSpecThreshold,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to save settings')
      }

      setSuccessMessage('Settings saved successfully')
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch {
      setError('Failed to save settings. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }, [projectId, settings])

  // Show loading state
  if (isLoadingProject || !project || !projectId || isLoading) {
    return (
      <>
        <PageHeader title="Agents" />
        <div className="flex-1 flex items-center justify-center">
          <Spinner size="lg" />
        </div>
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Agents"
        actions={
          <>
            <Button
              variant="primary"
              size="md"
              onClick={handleSave}
              loading={isSaving}
              disabled={isSaving}
            >
              Save Changes
            </Button>
          </>
        }
      />

      {error && (
        <Alert variant="warning">{error}</Alert>
      )}

      {successMessage && (
        <Alert variant="success">{successMessage}</Alert>
      )}

      {/* Support Agent Configuration */}
      <FloatingCard floating="gentle">
          <div className="space-y-6">
            <div className="flex items-start justify-between">
              <div>
                <Heading as="h2" size="section">Support Agent</Heading>
                <p className="mt-1 text-sm text-[color:var(--text-secondary)]">
                  Configure how the support agent responds to customer inquiries
                </p>
              </div>
              <Button
                variant="secondary"
                onClick={() => setShowTestAgent(true)}
              >
                Test Agent
              </Button>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <label className="block font-mono text-xs font-semibold uppercase text-[color:var(--text-secondary)] mb-2">
                  Tone of Voice
                </label>
                <Select
                  value={settings.supportAgent.toneOfVoice}
                  onChange={(e) => setSettings({
                    ...settings,
                    supportAgent: { ...settings.supportAgent, toneOfVoice: e.target.value }
                  })}
                >
                  <option value="professional">Professional</option>
                  <option value="friendly">Friendly</option>
                  <option value="technical">Technical</option>
                  <option value="casual">Casual</option>
                </Select>
                <p className="mt-1 text-xs text-[color:var(--text-tertiary)]">
                  The overall tone the agent uses in responses
                </p>
              </div>
            </div>

            <div>
              <label className="block font-mono text-xs font-semibold uppercase text-[color:var(--text-secondary)] mb-2">
                Brand Guidelines
              </label>
              <textarea
                value={settings.supportAgent.brandGuidelines}
                onChange={(e) => setSettings({
                  ...settings,
                  supportAgent: { ...settings.supportAgent, brandGuidelines: e.target.value }
                })}
                placeholder="Enter any brand-specific guidelines, terminology, or style instructions for the support agent..."
                rows={4}
                className="w-full rounded-[4px] border-2 border-[color:var(--border-subtle)] bg-[color:var(--surface)] px-3 py-2 font-mono text-sm text-[color:var(--foreground)] placeholder:text-[color:var(--text-tertiary)] focus:border-[color:var(--accent-selected)] focus:outline-none"
              />
              <p className="mt-1 text-xs text-[color:var(--text-tertiary)]">
                Custom instructions to align agent responses with your brand voice
              </p>
            </div>
          </div>
        </FloatingCard>

        {/* PM Agent Configuration */}
        <FloatingCard floating="gentle">
          <div className="space-y-6">
            <div>
              <Heading as="h2" size="section">PM Agent</Heading>
              <p className="mt-1 text-sm text-[color:var(--text-secondary)]">
                Configure how sessions are reviewed and specs are generated
              </p>
            </div>

            <div>
              <label className="block font-mono text-xs font-semibold uppercase text-[color:var(--text-secondary)] mb-2">
                Session Classification Guidelines
              </label>
              <textarea
                value={settings.pmAgent.classificationGuidelines}
                onChange={(e) => setSettings({
                  ...settings,
                  pmAgent: { ...settings.pmAgent, classificationGuidelines: e.target.value }
                })}
                placeholder="Enter guidelines for how sessions should be categorized and tagged (e.g., what constitutes a bug vs. feature request)..."
                rows={4}
                className="w-full rounded-[4px] border-2 border-[color:var(--border-subtle)] bg-[color:var(--surface)] px-3 py-2 font-mono text-sm text-[color:var(--foreground)] placeholder:text-[color:var(--text-tertiary)] focus:border-[color:var(--accent-selected)] focus:outline-none"
              />
              <p className="mt-1 text-xs text-[color:var(--text-tertiary)]">
                Instructions for how the PM agent should classify and tag customer sessions
              </p>
            </div>

            <div>
              <label className="block font-mono text-xs font-semibold uppercase text-[color:var(--text-secondary)] mb-2">
                Spec Generation Guidelines
              </label>
              <textarea
                value={settings.pmAgent.specGuidelines}
                onChange={(e) => setSettings({
                  ...settings,
                  pmAgent: { ...settings.pmAgent, specGuidelines: e.target.value }
                })}
                placeholder="Enter guidelines for how product specs should be written (e.g., required sections, level of detail, technical depth)..."
                rows={4}
                className="w-full rounded-[4px] border-2 border-[color:var(--border-subtle)] bg-[color:var(--surface)] px-3 py-2 font-mono text-sm text-[color:var(--foreground)] placeholder:text-[color:var(--text-tertiary)] focus:border-[color:var(--accent-selected)] focus:outline-none"
              />
              <p className="mt-1 text-xs text-[color:var(--text-tertiary)]">
                Instructions for how product specifications should be formatted and what to include
              </p>
            </div>

            <div className="max-w-xs">
              <label className="block font-mono text-xs font-semibold uppercase text-[color:var(--text-secondary)] mb-2">
                Auto-Spec Threshold
              </label>
              <div className="flex items-center gap-3">
                <Input
                  type="number"
                  min={1}
                  max={10}
                  value={settings.pmAgent.autoSpecThreshold}
                  onChange={(e) => setSettings({
                    ...settings,
                    pmAgent: { ...settings.pmAgent, autoSpecThreshold: parseInt(e.target.value) || 3 }
                  })}
                  className="w-20"
                />
                <span className="text-sm text-[color:var(--text-secondary)]">upvotes</span>
              </div>
              <p className="mt-1 text-xs text-[color:var(--text-tertiary)]">
                Number of upvotes an issue needs before a spec is automatically generated
              </p>
            </div>
          </div>
      </FloatingCard>

      {showTestAgent && (
        <TestAgentDialog
          project={project}
          onClose={() => setShowTestAgent(false)}
        />
      )}
    </>
  )
}
