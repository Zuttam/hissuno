'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type GitHubIntegrationStatus = {
  connected: boolean
  username: string | null
  userId: string | null
}

export function IntegrationsSection() {
  const [githubStatus, setGithubStatus] = useState<GitHubIntegrationStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isDisconnecting, setIsDisconnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchGitHubStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/integrations/github')
      if (!response.ok) {
        throw new Error('Failed to fetch GitHub status')
      }
      const data = await response.json()
      setGithubStatus(data)
    } catch (err) {
      console.error('Failed to fetch GitHub status:', err)
      setError('Failed to load integration status')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchGitHubStatus()
  }, [fetchGitHubStatus])

  const handleConnectGitHub = async () => {
    setIsConnecting(true)
    setError(null)

    try {
      const supabase = createClient()
      
      // Use linkIdentity to link GitHub account to existing user
      // Note: This requires enable_manual_linking = true in supabase/config.toml
      // and GitHub OAuth credentials to be set as environment variables
      const { error: linkError } = await supabase.auth.linkIdentity({
        provider: 'github',
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=/account/settings`,
          scopes: 'user:email read:user repo',
        },
      })

      if (linkError) {
        console.error('GitHub linkIdentity error:', linkError)
        
        // Provide helpful error messages
        if (linkError.message.includes('already linked')) {
          setError('This GitHub account is already linked to another user.')
        } else if (linkError.message.includes('provider is not enabled')) {
          setError('GitHub integration is not configured. Please ensure GitHub OAuth credentials are set.')
        } else if (linkError.message.includes('user profile')) {
          setError('Failed to get GitHub profile. Please check GitHub OAuth App configuration.')
        } else {
          setError(linkError.message)
        }
        setIsConnecting(false)
        return
      }
      // The user will be redirected to GitHub for authorization
    } catch (err) {
      console.error('Failed to connect GitHub:', err)
      setError(err instanceof Error ? err.message : 'Failed to connect GitHub')
      setIsConnecting(false)
    }
  }

  const handleDisconnectGitHub = async () => {
    setIsDisconnecting(true)
    setError(null)

    try {
      const response = await fetch('/api/integrations/github', {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to disconnect GitHub')
      }

      setGithubStatus({ connected: false, username: null, userId: null })
    } catch (err) {
      console.error('Failed to disconnect GitHub:', err)
      setError(err instanceof Error ? err.message : 'Failed to disconnect GitHub')
    } finally {
      setIsDisconnecting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse">
          <div className="h-6 w-32 rounded bg-slate-200 dark:bg-slate-700" />
          <div className="mt-4 h-16 rounded-lg bg-slate-100 dark:bg-slate-800" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-700 dark:bg-slate-800/60">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 dark:bg-white">
            <GitHubIcon className="h-5 w-5 text-white dark:text-slate-900" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-slate-900 dark:text-slate-50">GitHub</p>
            {githubStatus?.connected ? (
              <p className="text-sm text-emerald-600 dark:text-emerald-400">
                Connected as @{githubStatus.username || 'unknown'}
              </p>
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Not connected
              </p>
            )}
          </div>
          {githubStatus?.connected ? (
            <button
              type="button"
              onClick={handleDisconnectGitHub}
              disabled={isDisconnecting}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:text-slate-300 dark:hover:border-slate-500 dark:hover:bg-slate-700"
            >
              {isDisconnecting ? 'Disconnecting…' : 'Disconnect'}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleConnectGitHub}
              disabled={isConnecting}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
            >
              {isConnecting ? 'Connecting…' : 'Connect'}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-900/20 dark:text-rose-400">
          {error}
        </div>
      )}

      <p className="text-xs text-slate-500 dark:text-slate-400">
        Connect your GitHub account to import repositories directly into your projects.
      </p>
    </div>
  )
}

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
    </svg>
  )
}
