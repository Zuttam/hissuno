'use client'

import { useState } from 'react'
import { Button, Heading, Spinner } from '@/components/ui'
import { Card } from '@/components/ui/card'
import { KeyField } from '@/components/ui/key-field'
import { CreateApiKeyDialog } from '@/components/access/create-api-key-dialog'
import type { ApiKeyRecord } from '@/types/project-members'

interface ApiKeysSectionProps {
  projectId: string
  apiKeys: ApiKeyRecord[]
  isLoading: boolean
  onRefresh: () => Promise<void>
  isOwner: boolean
}

export function ApiKeysSection({ projectId, apiKeys, isLoading, onRefresh, isOwner }: ApiKeysSectionProps) {
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [revokingId, setRevokingId] = useState<string | null>(null)

  const handleRevoke = async (keyId: string) => {
    setRevokingId(keyId)
    try {
      const response = await fetch(`/api/projects/${projectId}/api-keys/${keyId}`, {
        method: 'DELETE',
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        const message = typeof payload?.error === 'string' ? payload.error : 'Failed to revoke key.'
        console.error('[access.api-keys] Revoke failed:', message)
      }
      await onRefresh()
    } catch (err) {
      console.error('[access.api-keys] Revoke error:', err)
    } finally {
      setRevokingId(null)
    }
  }

  const handleCreated = async () => {
    await onRefresh()
  }

  const activeKeys = apiKeys.filter((k) => !k.revoked_at)

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <Heading as="h3" size="subsection">API Keys</Heading>
        {isOwner && (
          <Button variant="secondary" size="sm" onClick={() => setShowCreateDialog(true)}>
            Create API Key
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner size="md" />
        </div>
      ) : activeKeys.length === 0 ? (
        <Card className="p-6">
          <p className="text-sm text-[color:var(--text-secondary)] text-center">
            No API keys yet. Create one to access the API programmatically.
          </p>
        </Card>
      ) : (
        <Card className="p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[color:var(--border-subtle)]">
                <th className="text-left px-4 py-3 font-mono text-xs font-semibold uppercase tracking-wide text-[color:var(--text-secondary)]">
                  Name
                </th>
                <th className="text-left px-4 py-3 font-mono text-xs font-semibold uppercase tracking-wide text-[color:var(--text-secondary)]">
                  Key
                </th>
                <th className="text-left px-4 py-3 font-mono text-xs font-semibold uppercase tracking-wide text-[color:var(--text-secondary)]">
                  Created
                </th>
                <th className="text-left px-4 py-3 font-mono text-xs font-semibold uppercase tracking-wide text-[color:var(--text-secondary)]">
                  Last Used
                </th>
                <th className="text-right px-4 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {activeKeys.map((key) => {
                const createdDate = new Date(key.created_at).toLocaleDateString()
                const lastUsed = key.last_used_at
                  ? new Date(key.last_used_at).toLocaleDateString()
                  : 'Never'

                return (
                  <tr key={key.id} className="border-b border-[color:var(--border-subtle)] last:border-b-0">
                    <td className="px-4 py-3 font-medium text-[color:var(--foreground)]">
                      {key.name}
                    </td>
                    <td className="px-4 py-3">
                      <KeyField
                        label="Key"
                        value={key.key_prefix + '...'}
                        compact
                      />
                    </td>
                    <td className="px-4 py-3 text-[color:var(--text-secondary)]">
                      {createdDate}
                    </td>
                    <td className="px-4 py-3 text-[color:var(--text-secondary)]">
                      {lastUsed}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {isOwner && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => void handleRevoke(key.id)}
                          loading={revokingId === key.id}
                        >
                          Revoke
                        </Button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Card>
      )}

      <CreateApiKeyDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        projectId={projectId}
        onCreated={handleCreated}
      />
    </div>
  )
}
