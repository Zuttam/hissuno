'use client'

import { useState, useEffect } from 'react'
import { Dialog, Button, Select, Heading, Alert } from '@/components/ui'
import { PackageSelector } from '@/components/projects/knowledge/package-selector'
import type { NamedPackageWithSources } from '@/lib/knowledge/types'
import type { ProjectRecord } from '@/lib/supabase/projects'

interface SupportAgentDialogProps {
  open: boolean
  onClose: () => void
  project: ProjectRecord
  projectId: string
  initialSettings: {
    toneOfVoice: string
    brandGuidelines: string
    packageId: string | null
  }
  packages: NamedPackageWithSources[]
  onSaved: () => void
  onOpenTestAgent: () => void
  onOpenKnowledgeDetail: () => void
}

export function SupportAgentDialog({
  open,
  onClose,
  project,
  projectId,
  initialSettings,
  packages,
  onSaved,
  onOpenTestAgent,
  onOpenKnowledgeDetail,
}: SupportAgentDialogProps) {
  const [toneOfVoice, setToneOfVoice] = useState(initialSettings.toneOfVoice)
  const [brandGuidelines, setBrandGuidelines] = useState(initialSettings.brandGuidelines)
  const [packageId, setPackageId] = useState(initialSettings.packageId)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset form when dialog opens with new settings
  useEffect(() => {
    if (open) {
      setToneOfVoice(initialSettings.toneOfVoice)
      setBrandGuidelines(initialSettings.brandGuidelines)
      setPackageId(initialSettings.packageId)
      setError(null)
    }
  }, [open, initialSettings])

  const handleSave = async () => {
    setIsSaving(true)
    setError(null)

    try {
      const [settingsRes, supportRes] = await Promise.all([
        fetch(`/api/projects/${projectId}/settings`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            support_agent_tone: toneOfVoice,
            brand_guidelines: brandGuidelines,
          }),
        }),
        fetch(`/api/projects/${projectId}/settings/support-agent`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ support_agent_package_id: packageId }),
        }),
      ])

      if (!settingsRes.ok || !supportRes.ok) {
        throw new Error('Failed to save settings')
      }

      onSaved()
      onClose()
    } catch {
      setError('Failed to save settings. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Support Specialist" size="xl">
      <div className="flex flex-col gap-6">
        {error && (
          <Alert variant="warning">{error}</Alert>
        )}

        {/* Configuration Section */}
        <div className="flex flex-col gap-8">
          <div className="flex justify-between">
            <Heading as="h3" size="subsection" >Configuration</Heading>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                onOpenTestAgent()
                onClose()
              }}
            >
              Test Agent
            </Button>
          </div>
          
          
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block font-mono text-xs font-semibold uppercase text-[color:var(--text-secondary)]">
                Knowledge Package
              </label>
              <Button
                variant="link"
                size="sm"
                onClick={() => {
                  onClose()
                  onOpenKnowledgeDetail()
                }}
              >
                Manage Packages
              </Button>
            </div>
            <PackageSelector
              projectId={projectId}
              value={packageId}
              onChange={setPackageId}
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
            <textarea
              value={brandGuidelines}
              onChange={(e) => setBrandGuidelines(e.target.value)}
              placeholder="Enter any brand-specific guidelines, terminology, or style instructions..."
              rows={3}
              className="w-full rounded-[4px] border-2 border-[color:var(--border-subtle)] bg-[color:var(--surface)] px-3 py-2 font-mono text-sm text-[color:var(--foreground)] placeholder:text-[color:var(--text-tertiary)] focus:border-[color:var(--accent-selected)] focus:outline-none"
            />
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
    </Dialog>
  )
}
