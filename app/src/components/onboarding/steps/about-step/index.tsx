'use client'

import { useCallback, useEffect } from 'react'
import Image from 'next/image'
import { Checkbox, Input, WizardStepHeader } from '@/components/ui'
import type { StepProps, OnboardingFormData, CommunicationChannel } from '../types'
import { COMMUNICATION_CHANNELS } from '../types'

const CHANNEL_LOGOS: Record<string, { src: string; alt: string }> = {
  intercom: { src: '/logos/intercom.svg', alt: 'Intercom' },
  gong: { src: '/logos/gong.svg', alt: 'Gong' },
  slack: { src: '/logos/slack.svg', alt: 'Slack' },
}

const AGENT_CHANNELS = [
  { label: 'Gmail', logo: '/logos/gmail.svg' },
  { label: 'Web Widget', icon: 'globe' as const },
  { label: 'Slack', logo: '/logos/slack.svg' },
]

function GlobeIcon() {
  return (
    <svg className="h-7 w-7 text-[--text-secondary]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5a17.92 17.92 0 01-8.716-2.247m0 0A8.966 8.966 0 013 12c0-1.257.26-2.454.726-3.541" />
    </svg>
  )
}

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

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {COMMUNICATION_CHANNELS.map((channel) => {
          const isSelected = selectedChannels.includes(channel.id)
          const logo = CHANNEL_LOGOS[channel.id]

          return (
            <div
              key={channel.id}
              role="button"
              tabIndex={0}
              onClick={() => handleToggleChannel(channel.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  handleToggleChannel(channel.id)
                }
              }}
              className={`relative flex flex-col items-center gap-2 rounded-lg border-2 px-3 py-4 text-center transition-all cursor-pointer ${
                isSelected
                  ? 'border-[--accent-selected] bg-[--accent-selected]/5'
                  : 'border-[--border-subtle] hover:border-[--accent-primary]'
              }`}
            >
              {/* Selection indicator */}
              <div className="absolute top-2 right-2">
                <Checkbox
                  checked={isSelected}
                  className="pointer-events-none"
                />
              </div>

              {/* Logo or emoji fallback */}
              {logo ? (
                <Image src={logo.src} alt={logo.alt} width={28} height={28} />
              ) : (
                <span className="text-2xl">{channel.emoji}</span>
              )}

              <span className="font-mono text-sm font-semibold text-[--foreground]">
                {channel.label}
              </span>
              <span className="text-xs text-[--text-secondary] leading-tight">
                {channel.description}
              </span>
            </div>
          )
        })}
      </div>

      {/* "Other" text input */}
      {selectedChannels.includes('other') && (
        <div className="mt-3">
          <Input
            type="text"
            placeholder="e.g. Zendesk, Freshdesk, HubSpot..."
            value={otherChannelText}
            onChange={handleOtherTextChange}
            autoFocus
          />
        </div>
      )}

      {/* Divider */}
      <div className="my-8 border-t border-[--border-subtle]" />

      {/* AI Support Agents section */}
      <div className="text-center">
        <p className="font-mono text-sm font-semibold text-[--foreground]">
          Hissuno also offers complementary AI Support Agents 🤖
        </p>
        <p className="mt-1 text-xs text-[--text-secondary]">
          Available across these channels after onboarding
        </p>

        <div className="mt-5 flex items-center justify-center gap-6">
          {AGENT_CHANNELS.map((ch) => (
            <div key={ch.label} className="flex flex-col items-center gap-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[--surface] border border-[--border-subtle]">
                {ch.logo ? (
                  <Image src={ch.logo} alt={ch.label} width={24} height={24} />
                ) : (
                  <GlobeIcon />
                )}
              </div>
              <span className="text-xs text-[--text-secondary]">{ch.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
