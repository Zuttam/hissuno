'use client'

import { useState } from 'react'
import { Badge, Button, Spinner } from '@/components/ui'
import { Card } from '@/components/ui/card'
import { AddMemberDialog } from '@/components/access/add-member-dialog'
import type { ProjectMemberWithProfile } from '@/types/project-members'

interface MembersSectionProps {
  projectId: string
  members: ProjectMemberWithProfile[]
  isLoading: boolean
  onRefresh: () => Promise<void>
  isOwner: boolean
}

function RoleBadge({ role }: { role: string }) {
  return (
    <Badge variant={role === 'owner' ? 'info' : 'default'}>
      {role}
    </Badge>
  )
}

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant={status === 'active' ? 'success' : 'warning'}>
      {status === 'active' ? 'Active' : 'Pending'}
    </Badge>
  )
}

export function MembersSection({ projectId, members, isLoading, onRefresh, isOwner }: MembersSectionProps) {
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)

  const handleRemove = async (memberId: string) => {
    setRemovingId(memberId)
    try {
      const response = await fetch(`/api/projects/${projectId}/members/${memberId}`, {
        method: 'DELETE',
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        const message = typeof payload?.error === 'string' ? payload.error : 'Failed to remove member.'
        console.error('[access.members] Remove failed:', message)
      }
      await onRefresh()
    } catch (err) {
      console.error('[access.members] Remove error:', err)
    } finally {
      setRemovingId(null)
    }
  }

  const handleAdded = async () => {
    setShowAddDialog(false)
    await onRefresh()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-mono text-sm font-semibold uppercase tracking-wide text-[color:var(--text-secondary)]">
          Members
        </h3>
        {isOwner && (
          <Button variant="secondary" size="sm" onClick={() => setShowAddDialog(true)}>
            Add Member
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner size="md" />
        </div>
      ) : members.length === 0 ? (
        <Card className="p-6">
          <p className="text-sm text-[color:var(--text-secondary)] text-center">
            No members yet.
          </p>
        </Card>
      ) : (
        <Card className="p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[color:var(--border-subtle)]">
                <th className="text-left px-4 py-3 font-mono text-xs font-semibold uppercase tracking-wide text-[color:var(--text-secondary)]">
                  Member
                </th>
                <th className="text-left px-4 py-3 font-mono text-xs font-semibold uppercase tracking-wide text-[color:var(--text-secondary)]">
                  Role
                </th>
                <th className="text-left px-4 py-3 font-mono text-xs font-semibold uppercase tracking-wide text-[color:var(--text-secondary)]">
                  Status
                </th>
                <th className="text-left px-4 py-3 font-mono text-xs font-semibold uppercase tracking-wide text-[color:var(--text-secondary)]">
                  Added
                </th>
                <th className="text-right px-4 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => {
                const displayName = member.user_profile?.full_name || member.invited_email || 'Unknown'
                const displayEmail = member.user_profile?.email || member.invited_email || ''
                const addedDate = new Date(member.created_at).toLocaleDateString()

                return (
                  <tr key={member.id} className="border-b border-[color:var(--border-subtle)] last:border-b-0">
                    <td className="px-4 py-3">
                      <div>
                        <div className="font-medium text-[color:var(--foreground)]">{displayName}</div>
                        {displayEmail && displayName !== displayEmail && (
                          <div className="text-xs text-[color:var(--text-tertiary)]">{displayEmail}</div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <RoleBadge role={member.role} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={member.status} />
                    </td>
                    <td className="px-4 py-3 text-[color:var(--text-secondary)]">
                      {addedDate}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {isOwner && member.role !== 'owner' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => void handleRemove(member.id)}
                          loading={removingId === member.id}
                        >
                          {member.status === 'pending' ? 'Cancel' : 'Remove'}
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

      <AddMemberDialog
        open={showAddDialog}
        onClose={() => setShowAddDialog(false)}
        projectId={projectId}
        onAdded={handleAdded}
      />
    </div>
  )
}
