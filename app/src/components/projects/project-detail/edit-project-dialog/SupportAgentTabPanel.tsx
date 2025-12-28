'use client'

import { FormField, ChipInput, SectionHeader } from '@/components/ui'

interface SupportAgentTabPanelProps {
  allowedOrigins: string[]
  setAllowedOrigins: (origins: string[]) => void
}

export function SupportAgentTabPanel({
  allowedOrigins,
  setAllowedOrigins,
}: SupportAgentTabPanelProps) {
  const validateOrigin = (value: string): true | string => {
    // Basic URL/origin validation
    if (value === '*') return true
    try {
      const url = new URL(value.startsWith('http') ? value : `https://${value}`)
      if (!url.origin) return 'Invalid origin'
      return true
    } catch {
      // Allow localhost patterns
      if (value.match(/^(localhost|127\.0\.0\.1)(:\d+)?$/)) return true
      return 'Invalid origin format'
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <SectionHeader
        title="Widget Integration"
      />
      <FormField
        label="Allowed Origins"
        description="Domains where the support widget is allowed to run. Leave empty to allow all origins (development mode)."
      >
        <ChipInput
          values={allowedOrigins}
          onChange={setAllowedOrigins}
          placeholder="e.g., https://example.com"
          validateFn={validateOrigin}
        />
      </FormField>
    </div>
  )
}
