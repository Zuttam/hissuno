'use client'

import { useCallback, useEffect, useState } from 'react'
import { Divider, WizardStepHeader } from '@/components/ui'
import type { StepProps, CustomTagConfig } from '../types'
import { WidgetChannel } from './widget-channel'
import type { WidgetData } from './widget-channel'
import { SlackChannel } from './slack-channel'
import { GongChannel } from './gong-channel'
import { IntercomChannel } from './intercom-channel'
import { CustomTagsSection } from './custom-tags-section'
import type { LocalCustomTag } from './custom-tags-section'
import { useCustomTags } from '@/hooks/use-custom-tags'
import type { TagColorVariant } from '@/types/session'

const MAX_TAGS = 10

export function SessionsStep({ context, onValidationChange, title, description }: StepProps) {
  const { formData, setFormData, integrations, mode, projectId } = context

  // Track whether we've initialized local tags from server
  const [hasInitializedTags, setHasInitializedTags] = useState(false)

  // Custom tags hook (only active in edit mode when we have a projectId)
  const {
    tags: serverTags,
    isLoading: isLoadingTags,
    error: tagsError,
  } = useCustomTags({ projectId })

  // Local tags state - initialized from formData or server
  const localTags: LocalCustomTag[] = formData.customTags.map((tag) => ({
    id: tag.id,
    name: tag.name,
    slug: tag.slug,
    description: tag.description,
    color: tag.color as TagColorVariant,
    position: tag.position,
  }))

  // Initialize local tags from server when tags are fetched
  useEffect(() => {
    if (mode === 'edit' && projectId && serverTags.length > 0 && !hasInitializedTags) {
      const serverTagsAsConfig: CustomTagConfig[] = serverTags.map((tag) => ({
        id: tag.id,
        name: tag.name,
        slug: tag.slug,
        description: tag.description,
        color: tag.color as TagColorVariant,
        position: tag.position,
      }))
      setFormData((prev) => ({
        ...prev,
        customTags: serverTagsAsConfig,
      }))
      setHasInitializedTags(true)
    }
  }, [mode, projectId, serverTags, hasInitializedTags, setFormData])

  // Also mark as initialized if there are no server tags but loading is complete
  useEffect(() => {
    if (mode === 'edit' && projectId && !isLoadingTags && serverTags.length === 0 && !hasInitializedTags) {
      setHasInitializedTags(true)
    }
  }, [mode, projectId, isLoadingTags, serverTags.length, hasInitializedTags])

  // Sessions step is always valid (optional)
  useEffect(() => {
    onValidationChange?.(true)
  }, [onValidationChange])

  const handleWidgetChange = useCallback(
    (updates: Partial<WidgetData>) => {
      setFormData((prev) => ({
        ...prev,
        widget: { ...prev.widget, ...updates },
      }))
    },
    [setFormData]
  )

  // Handle tags change - update formData
  const handleTagsChange = useCallback(
    (tags: LocalCustomTag[]) => {
      const tagsAsConfig: CustomTagConfig[] = tags.map((tag) => ({
        id: tag.id,
        name: tag.name,
        slug: tag.slug,
        description: tag.description,
        color: tag.color,
        position: tag.position,
      }))
      setFormData((prev) => ({
        ...prev,
        customTags: tagsAsConfig,
      }))
    },
    [setFormData]
  )

  const canAddMoreTags = localTags.length < MAX_TAGS

  return (
    <div>
      <WizardStepHeader title={title} description={description} />

      {/* Hissuno Native Agents */}
      <div className="mb-6">
        <h3 className="text-xs font-medium text-[color:var(--text-secondary)] uppercase tracking-wide mb-2">
          Hissuno Native Agents
        </h3>
        <div className="flex flex-col">
          <WidgetChannel
            widget={formData.widget}
            onWidgetChange={handleWidgetChange}
          />

          <Divider />

          <SlackChannel
            integration={{
              isConnected: integrations.slack.isConnected,
              isConnecting: integrations.slack.isConnecting,
              workspaceName: integrations.slack.workspaceName,
              onConnect: integrations.slack.onConnect,
              onDisconnect: integrations.slack.onDisconnect,
            }}
          />
        </div>
      </div>

      {/* Custom Tags - Only show in edit mode */}
      {mode === 'edit' && projectId && (
        <div className="mb-6">
          <h3 className="text-xs font-medium text-[color:var(--text-secondary)] uppercase tracking-wide mb-2">
            Custom Classification Tags
          </h3>
          <CustomTagsSection
            tags={localTags}
            onTagsChange={handleTagsChange}
            canAddMore={canAddMoreTags}
            isLoading={isLoadingTags && !hasInitializedTags}
            error={tagsError}
          />
        </div>
      )}

      {/* Integrations */}
      <div>
        <h3 className="text-xs font-medium text-[color:var(--text-secondary)] uppercase tracking-wide mb-2">
          Integrations
        </h3>
        <div className="flex flex-col">
          <GongChannel />

          <div className="border-b border-[color:var(--border-subtle)] w-full" />

          <IntercomChannel />
        </div>
      </div>
    </div>
  )
}
