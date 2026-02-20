'use client'

import { useState, useCallback, useEffect } from 'react'
import { FormField, Input, Select, Button, Heading } from '@/components/ui'
import { Card } from '@/components/ui/card'

type CompanySize = '1-10' | '11-50' | '51-200' | '201-500' | '500+' | ''

interface ProfileData {
  full_name: string | null
  company_name: string | null
  role: string | null
  company_size: CompanySize | null
}

interface ProfileSectionProps {
  email?: string | null
}

const COMPANY_SIZE_OPTIONS: { value: CompanySize; label: string }[] = [
  { value: '', label: 'Select company size' },
  { value: '1-10', label: '1-10 employees' },
  { value: '11-50', label: '11-50 employees' },
  { value: '51-200', label: '51-200 employees' },
  { value: '201-500', label: '201-500 employees' },
  { value: '500+', label: '500+ employees' },
]

export function ProfileSection({ email }: ProfileSectionProps) {
  const [profile, setProfile] = useState<ProfileData>({
    full_name: null,
    company_name: null,
    role: null,
    company_size: null,
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Fetch profile on mount
  useEffect(() => {
    async function fetchProfile() {
      try {
        const response = await fetch('/api/user/profile')
        const data = await response.json()
        if (data.profile) {
          setProfile({
            full_name: data.profile.full_name ?? null,
            company_name: data.profile.company_name ?? null,
            role: data.profile.role ?? null,
            company_size: data.profile.company_size ?? null,
          })
        }
      } catch (err) {
        console.error('Failed to fetch profile:', err)
      } finally {
        setIsLoading(false)
      }
    }
    void fetchProfile()
  }, [])

  const handleFieldChange = useCallback(
    (field: keyof ProfileData) =>
      (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setProfile((prev) => ({
          ...prev,
          [field]: e.target.value || null,
        }))
        // Clear messages when user starts editing
        setError(null)
        setSuccessMessage(null)
      },
    []
  )

  const handleSave = useCallback(async () => {
    setIsSaving(true)
    setError(null)
    setSuccessMessage(null)

    try {
      const response = await fetch('/api/user/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: profile.full_name,
          companyName: profile.company_name,
          role: profile.role,
          companySize: profile.company_size,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error ?? 'Failed to save profile')
      }

      setSuccessMessage('Profile saved successfully')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save profile')
    } finally {
      setIsSaving(false)
    }
  }, [profile])

  if (isLoading) {
    return (
      <Card
        className="space-y-4 border border-slate-200 bg-white/70 p-8 dark:border-slate-800 dark:bg-slate-900/60"
      >
        <Heading as="h2" size="section">Profile</Heading>
        <div className="animate-pulse space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 rounded-lg bg-slate-200 dark:bg-slate-700" />
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
          <Heading as="h2" size="section">Profile</Heading>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Manage how Hissuno recognizes you across projects.
          </p>
        </div>
        <Button
          variant="primary"
          size="md"
          onClick={() => void handleSave()}
          disabled={isSaving}
          className="shrink-0"
        >
          {isSaving ? 'Saving...' : 'Save Profile'}
        </Button>
      </div>

      <div className="flex flex-col gap-4">
        <FormField label="Email">
          <Input
            type="email"
            value={email ?? ''}
            readOnly
            className="cursor-not-allowed opacity-60"
          />
        </FormField>

        <FormField label="Full Name">
          <Input
            type="text"
            placeholder="John Doe"
            value={profile.full_name ?? ''}
            onChange={handleFieldChange('full_name')}
          />
        </FormField>

        <FormField label="Company Name">
          <Input
            type="text"
            placeholder="Acme Inc."
            value={profile.company_name ?? ''}
            onChange={handleFieldChange('company_name')}
          />
        </FormField>

        <FormField label="Your Role">
          <Input
            type="text"
            placeholder="Product Manager, Engineer, etc."
            value={profile.role ?? ''}
            onChange={handleFieldChange('role')}
          />
        </FormField>

        <FormField label="Company Size">
          <Select
            value={profile.company_size ?? ''}
            onChange={handleFieldChange('company_size')}
          >
            {COMPANY_SIZE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </FormField>
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
