'use client'

import { useState, useCallback, useEffect } from 'react'
import { Checkbox, Badge, Divider, Heading, Button, Select, FormField } from '@/components/ui'
import { Card } from '@/components/ui/card'
import {
  NOTIFICATION_TYPE_INFO,
  resolvePreferences,
  type NotificationPreferences,
} from '@/types/notification-preferences'
import { fetchNotificationPreferences, saveNotificationPreferences } from '@/lib/api/user'

interface SlackChannel {
  id: string
  name: string
}

const NOTIFICATION_TIPS = [
  'When you receive a "human needed" notification, you can reply within the Slack thread to respond to the end user directly.',
]

export function NotificationPreferencesSection() {
  const [preferences, setPreferences] = useState<NotificationPreferences>(() =>
    resolvePreferences(null)
  )
  const [silenced, setSilenced] = useState(false)
  const [slackAvailable, setSlackAvailable] = useState(false)
  const [slackNotificationChannel, setSlackNotificationChannel] = useState<string | null>(null)
  const [availableSlackChannels, setAvailableSlackChannels] = useState<SlackChannel[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Random tip on mount
  const [currentTipIndex] = useState(() => Math.floor(Math.random() * NOTIFICATION_TIPS.length))

  useEffect(() => {
    async function loadPreferences() {
      try {
        const data = await fetchNotificationPreferences<{
          preferences?: NotificationPreferences
          silenced?: boolean
          slackAvailable?: boolean
          slackNotificationChannel?: string | null
          availableSlackChannels?: SlackChannel[]
        }>()
        if (data.preferences) {
          setPreferences(resolvePreferences(data.preferences))
        }
        if (data.silenced !== undefined) {
          setSilenced(data.silenced)
        }
        if (data.slackAvailable !== undefined) {
          setSlackAvailable(data.slackAvailable)
        }
        if (data.slackNotificationChannel !== undefined) {
          setSlackNotificationChannel(data.slackNotificationChannel)
        }
        if (data.availableSlackChannels) {
          setAvailableSlackChannels(data.availableSlackChannels)
        }
      } catch (err) {
        console.error('Failed to fetch notification preferences:', err)
      } finally {
        setIsLoading(false)
      }
    }
    void loadPreferences()
  }, [])

  const handleToggle = useCallback(
    (type: string, channel: 'email' | 'slack', checked: boolean) => {
      setPreferences((prev) => ({
        ...prev,
        [type]: {
          ...prev[type as keyof NotificationPreferences],
          [channel]: checked,
        },
      }))
      setError(null)
      setSuccessMessage(null)
    },
    []
  )

  const handleSilenceToggle = useCallback((checked: boolean) => {
    setSilenced(checked)
    setError(null)
    setSuccessMessage(null)
  }, [])

  const handleChannelChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value
    setSlackNotificationChannel(value === '' ? null : value)
    setError(null)
    setSuccessMessage(null)
  }, [])

  const handleSave = useCallback(async () => {
    setIsSaving(true)
    setError(null)
    setSuccessMessage(null)

    try {
      const response = await saveNotificationPreferences({ preferences, silenced, slackNotificationChannel })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error ?? 'Failed to save preferences')
      }

      setSuccessMessage('Notification preferences saved')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save preferences')
    } finally {
      setIsSaving(false)
    }
  }, [preferences, silenced, slackNotificationChannel])

  if (isLoading) {
    return (
      <Card
        className="space-y-4 border border-slate-200 bg-white/70 p-8 dark:border-slate-800 dark:bg-slate-900/60"
      >
        <Heading as="h2" size="section">Notification Preferences</Heading>
        <div className="animate-pulse space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-12 rounded-lg bg-slate-200 dark:bg-slate-700" />
          ))}
        </div>
      </Card>
    )
  }

  return (
    <Card
      className="space-y-6 border border-slate-200 bg-white/70 p-8 dark:border-slate-800 dark:bg-slate-900/60"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <Heading as="h2" size="section">Notification Preferences</Heading>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Control how and when you receive notifications from Hissuno.
          </p>
        </div>
        <Button
          variant="primary"
          size="md"
          onClick={() => void handleSave()}
          disabled={isSaving || silenced === undefined}
          className="shrink-0"
        >
          {isSaving ? 'Saving...' : 'Save Preferences'}
        </Button>
      </div>

      {/* Slack Channel Selector */}
      <FormField label="Slack Notification Channel">
        <Select
          value={slackNotificationChannel ?? ''}
          onChange={handleChannelChange}
          disabled={!slackAvailable}
        >
          <option value="">DM to you (default)</option>
          {availableSlackChannels.map((channel) => (
            <option key={channel.id} value={channel.id}>
              #{channel.name}
            </option>
          ))}
        </Select>
        {!slackAvailable && (
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Connect Slack to a project first to enable channel selection
          </p>
        )}
      </FormField>

      <Checkbox
        checked={silenced}
        onChange={handleSilenceToggle}
        label="Silence all notifications"
      />

      <Divider />

      <div className={silenced ? 'pointer-events-none opacity-40' : ''}>
        {/* Header row */}
        <div className="mb-3 grid grid-cols-[1fr_60px_60px] items-center gap-2 px-1">
          <span className="text-xs font-mono uppercase tracking-wider text-slate-400">
            Type
          </span>
          <span className="text-center text-xs font-mono uppercase tracking-wider text-slate-400">
            Email
          </span>
          <span className="text-center text-xs font-mono uppercase tracking-wider text-slate-400">
            Slack
          </span>
        </div>

        {/* Preference rows */}
        <div className="flex flex-col gap-1">
          {NOTIFICATION_TYPE_INFO.map((info) => {
            const pref = preferences[info.type]
            const isActive = info.active
            const slackSupported = info.supportedChannels.includes('slack')
            const emailSupported = info.supportedChannels.includes('email')

            const emailDisabled = !isActive || !emailSupported || silenced
            const slackDisabled = !isActive || !slackSupported || !slackAvailable || silenced

            // Build tooltip reason for disabled checkboxes
            const getDisabledReason = (channel: 'email' | 'slack') => {
              if (!isActive) return 'This notification type is coming soon'
              if (silenced) return 'All notifications are silenced'
              if (channel === 'email' && !emailSupported) return 'Email is not supported for this type'
              if (channel === 'slack') {
                if (!slackSupported) return 'Slack is not supported for this type'
                if (!slackAvailable) return 'Connect Slack to a project first to enable Slack notifications'
              }
              return undefined
            }

            return (
              <div
                key={info.type}
                className="grid grid-cols-[1fr_60px_60px] items-center gap-2 rounded-md px-1 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/50"
              >
                <div className="flex items-center gap-2">
                  <div>
                    <span className="text-sm font-medium text-[--foreground]">
                      {info.label}
                    </span>
                    {!isActive && (
                      <Badge variant="default" className="ml-2">
                        Coming soon
                      </Badge>
                    )}
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {info.description}
                    </p>
                  </div>
                </div>

                <div className="flex justify-center" title={emailDisabled ? getDisabledReason('email') : undefined}>
                  <Checkbox
                    checked={pref?.email ?? true}
                    onChange={(checked) => handleToggle(info.type, 'email', checked)}
                    disabled={emailDisabled}
                  />
                </div>

                <div className="flex justify-center" title={slackDisabled ? getDisabledReason('slack') : undefined}>
                  <Checkbox
                    checked={pref?.slack ?? false}
                    onChange={(checked) => handleToggle(info.type, 'slack', checked)}
                    disabled={slackDisabled}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Tips footer */}
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          <span className="mr-2">💡</span>
          {NOTIFICATION_TIPS[currentTipIndex]}
        </p>
      </div>

      {error && (
        <div className="rounded-[4px] border-2 border-[--accent-danger] bg-transparent px-3 py-2 text-sm font-mono text-[--foreground]">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="rounded-[4px] border-2 border-[--accent-success] bg-transparent px-3 py-2 text-sm font-mono text-[--foreground]">
          {successMessage}
        </div>
      )}
    </Card>
  )
}
