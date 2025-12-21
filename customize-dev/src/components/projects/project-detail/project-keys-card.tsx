'use client'

import { useState } from 'react'
import type { ProjectWithCodebase } from '@/lib/projects/queries'

interface ProjectKeysCardProps {
  project: ProjectWithCodebase & {
    public_key?: string | null
    secret_key?: string | null
    allowed_origins?: string[] | null
  }
  isLoading?: boolean
}

export function ProjectKeysCard({ project, isLoading }: ProjectKeysCardProps) {
  const [showSecretKey, setShowSecretKey] = useState(false)
  const [copiedField, setCopiedField] = useState<string | null>(null)

  const copyToClipboard = async (value: string, fieldName: string) => {
    try {
      await navigator.clipboard.writeText(value)
      setCopiedField(fieldName)
      setTimeout(() => setCopiedField(null), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6 rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
        <div className="animate-pulse space-y-4">
          <div className="h-4 w-32 rounded bg-slate-200 dark:bg-slate-700" />
          <div className="space-y-2">
            <div className="h-3 w-full rounded bg-slate-200 dark:bg-slate-700" />
            <div className="h-3 w-3/4 rounded bg-slate-200 dark:bg-slate-700" />
          </div>
        </div>
      </div>
    )
  }

  const publicKey = project.public_key ?? 'Not generated'
  const secretKey = project.secret_key ?? 'Not generated'
  const allowedOrigins = project.allowed_origins ?? []

  return (
    <div className="space-y-6 rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
      <div className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Widget Integration
        </h3>
        
        <div className="space-y-4">
          {/* Project ID */}
          <KeyField
            label="Project ID"
            value={project.id}
            onCopy={() => copyToClipboard(project.id, 'projectId')}
            copied={copiedField === 'projectId'}
          />

          {/* Public Key */}
          <KeyField
            label="Public Key"
            value={publicKey}
            description="Safe to use in frontend code"
            onCopy={() => copyToClipboard(publicKey, 'publicKey')}
            copied={copiedField === 'publicKey'}
            disabled={!project.public_key}
          />

          {/* Secret Key */}
          <KeyField
            label="Secret Key"
            value={showSecretKey ? secretKey : maskKey(secretKey)}
            description="Keep this secret! Never expose in frontend"
            onCopy={() => copyToClipboard(secretKey, 'secretKey')}
            copied={copiedField === 'secretKey'}
            masked={!showSecretKey && !!project.secret_key}
            onToggleMask={() => setShowSecretKey(!showSecretKey)}
            disabled={!project.secret_key}
            isSecret
          />
        </div>
      </div>

      {/* Allowed Origins */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Allowed Origins
        </h3>
        {allowedOrigins.length > 0 ? (
          <div className="space-y-2">
            {allowedOrigins.map((origin, index) => (
              <div
                key={index}
                className="flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-300"
              >
                <span className="font-mono">{origin}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            No origins configured. Widget will work from any domain (development mode).
          </p>
        )}
      </div>

      {/* Integration Code Snippet */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Quick Start
        </h3>
        <div className="relative">
          <pre className="overflow-x-auto rounded-lg bg-slate-900 p-4 text-sm text-slate-100">
            <code>{generateSnippet(project.id, publicKey)}</code>
          </pre>
          <button
            type="button"
            onClick={() => copyToClipboard(generateSnippet(project.id, publicKey), 'snippet')}
            className="absolute right-2 top-2 rounded-md bg-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-600"
          >
            {copiedField === 'snippet' ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>
    </div>
  )
}

interface KeyFieldProps {
  label: string
  value: string
  description?: string
  onCopy: () => void
  copied: boolean
  masked?: boolean
  onToggleMask?: () => void
  disabled?: boolean
  isSecret?: boolean
}

function KeyField({
  label,
  value,
  description,
  onCopy,
  copied,
  masked,
  onToggleMask,
  disabled,
  isSecret,
}: KeyFieldProps) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">
          {label}
        </span>
        {description && (
          <span className={`text-xs ${isSecret ? 'text-amber-500' : 'text-emerald-500'}`}>
            {description}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1 rounded-lg bg-slate-100 px-3 py-2 dark:bg-slate-800">
          <code className="text-sm text-slate-700 dark:text-slate-200">
            {disabled ? <span className="text-slate-400">Not generated yet</span> : value}
          </code>
        </div>
        <div className="flex gap-1">
          {onToggleMask && !disabled && (
            <button
              type="button"
              onClick={onToggleMask}
              className="rounded-md bg-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
              title={masked ? 'Show' : 'Hide'}
            >
              {masked ? '👁' : '🙈'}
            </button>
          )}
          <button
            type="button"
            onClick={onCopy}
            disabled={disabled}
            className="rounded-md bg-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-300 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
          >
            {copied ? '✓' : 'Copy'}
          </button>
        </div>
      </div>
    </div>
  )
}

function maskKey(key: string): string {
  if (!key || key === 'Not generated') return key
  // Show first 8 chars and last 4 chars
  if (key.length <= 12) return '•'.repeat(key.length)
  return key.slice(0, 8) + '•'.repeat(key.length - 12) + key.slice(-4)
}

function generateSnippet(projectId: string, publicKey: string): string {
  return `import { CustomizeWidget } from '@customize/widget';

<CustomizeWidget 
  projectId="${projectId}"
  publicKey="${publicKey}"
/>`
}

