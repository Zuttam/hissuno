'use client'

import { useCallback, useEffect } from 'react'
import { Checkbox, Input, WizardStepHeader } from '@/components/ui'
import type { StepProps, OnboardingFormData, CommunicationChannel } from '../types'
import { COMMUNICATION_CHANNELS } from '../types'

export function AboutStep({ context, onValidationChange, title, description }: StepProps) {
  const { formData, setFormData } = context
  const onboardingData = formData as OnboardingFormData
  const selectedChannels = onboardingData.about?.selectedChannels ?? []
  const otherChannelText = onboardingData.about?.otherChannelText ?? ''

  // This step is always valid (optional selection)
  useEffect(() => {
    onValidationChange?.(true)
  }, [onValidationChange])

  const handleToggleChannel = useCallback(
    (channelId: CommunicationChannel) => {
      setFormData((prev) => {
        const onboarding = prev as OnboardingFormData
        const current = onboarding.about?.selectedChannels ?? []
        const isSelected = current.includes(channelId)

        const newSelection = isSelected
          ? current.filter((id) => id !== channelId)
          : [...current, channelId]

        return {
          ...onboarding,
          about: {
            ...onboarding.about,
            selectedChannels: newSelection,
            // Clear other text if "other" is deselected
            otherChannelText: channelId === 'other' && isSelected ? '' : onboarding.about.otherChannelText,
          },
        }
      })
    },
    [setFormData]
  )

  const handleOtherTextChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setFormData((prev) => {
        const onboarding = prev as OnboardingFormData
        return {
          ...onboarding,
          about: {
            ...onboarding.about,
            otherChannelText: e.target.value,
          },
        }
      })
    },
    [setFormData]
  )

  return (
    <div>
      <WizardStepHeader title={title} description={description} />

      <div className="grid gap-4">
        {COMMUNICATION_CHANNELS.map((channel) => {
          const isSelected = selectedChannels.includes(channel.id)
          return (
            <div key={channel.id}>
              <div
                role="button"
                tabIndex={0}
                onClick={() => handleToggleChannel(channel.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    handleToggleChannel(channel.id)
                  }
                }}
                className={`flex items-start gap-4 rounded-lg border-2 p-4 text-left transition-all cursor-pointer ${
                  isSelected
                    ? 'border-[--accent-selected] bg-[--accent-selected]/5'
                    : 'border-[--border-subtle] hover:border-[--accent-primary]'
                }`}
              >
                <Checkbox
                  checked={isSelected}
                  className="mt-0.5 pointer-events-none"
                />

                <div className="flex-1">
                  <h3 className="font-mono font-semibold text-[--foreground]">
                    <span className="mr-2">{channel.emoji}</span>{channel.label}
                  </h3>
                  <p className="mt-1 text-sm text-[--text-secondary]">
                    {channel.description}
                  </p>
                </div>
              </div>

              {/* Show text input when "Other" is selected */}
              {channel.id === 'other' && isSelected && (
                <div className="mt-2 ml-12">
                  <Input
                    type="text"
                    placeholder="e.g. Zendesk, Freshdesk, HubSpot..."
                    value={otherChannelText}
                    onChange={handleOtherTextChange}
                    autoFocus
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>

      <p className="mt-6 text-xs text-[--text-tertiary]">
        BTW Hissuno also offers ready-to-go AI Support Agents in various channels — visit the integrations page after onboarding :)
      </p>
    </div>
  )
}
