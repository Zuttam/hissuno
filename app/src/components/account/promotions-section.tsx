'use client'

import { useState, useCallback } from 'react'
import { Button, Heading, Dialog, Input } from '@/components/ui'
import { FloatingCard } from '@/components/ui/floating-card'
import { useInvites } from '@/hooks/use-invites'
import type { InviteWithClaimInfo } from '@/types/invites'

function CopyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184" />
    </svg>
  )
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  )
}

function MailIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
    </svg>
  )
}

interface SendInviteDialogProps {
  invite: InviteWithClaimInfo
  open: boolean
  onClose: () => void
}

function SendInviteDialog({ invite, open, onClose }: SendInviteDialogProps) {
  const [email, setEmail] = useState(invite.target_email ?? '')
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  const handleSend = useCallback(async () => {
    const trimmed = email.trim()
    if (!trimmed) return

    setIsSending(true)
    setError(null)

    try {
      const response = await fetch('/api/user/invites/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteId: invite.id, recipientEmail: trimmed }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to send invite.')
        return
      }

      setSent(true)
      setTimeout(() => {
        onClose()
        setSent(false)
        setEmail('')
      }, 1500)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setIsSending(false)
    }
  }, [email, invite.id, onClose])

  const handleClose = useCallback(() => {
    setError(null)
    setSent(false)
    onClose()
  }, [onClose])

  return (
    <Dialog open={open} onClose={handleClose} title="Send Invite">
      <div className="space-y-4">
        {sent ? (
          <div className="flex items-center gap-2 text-[--accent-success]">
            <CheckIcon className="h-5 w-5" />
            <span className="text-sm font-medium">Invite sent!</span>
          </div>
        ) : (
          <>
            <p className="text-sm text-[var(--text-secondary)]">
              Send invite code <strong>{invite.code}</strong> via email.
            </p>
            <Input
              type="email"
              placeholder="recipient@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isSending}
              autoFocus
            />
            {error && (
              <p className="text-sm text-[var(--accent-danger)]">{error}</p>
            )}
            <div className="flex justify-end gap-3">
              <Button type="button" variant="secondary" onClick={handleClose} disabled={isSending}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => void handleSend()}
                disabled={isSending || !email.trim()}
                className="bg-[var(--accent-selected)] hover:opacity-90"
              >
                {isSending ? 'Sending...' : 'Send Invite'}
              </Button>
            </div>
          </>
        )}
      </div>
    </Dialog>
  )
}

interface InviteRowProps {
  invite: InviteWithClaimInfo
}

function InviteRow({ invite }: InviteRowProps) {
  const [copiedLink, setCopiedLink] = useState(false)
  const [showSendDialog, setShowSendDialog] = useState(false)

  const inviteLink = typeof window !== 'undefined'
    ? `${window.location.origin}/signup?invite=${invite.code}`
    : `https://hissuno.com/signup?invite=${invite.code}`

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(inviteLink)
      setCopiedLink(true)
      setTimeout(() => setCopiedLink(false), 2000)
    } catch {
      console.error('Failed to copy link')
    }
  }, [inviteLink])

  const isClaimed = !!invite.claimed_by_user_id

  if (isClaimed) {
    return (
      <div className="flex items-center justify-between rounded-[4px] border-2 border-[--border-subtle] bg-[--surface] px-3 py-2">
        <div className="flex items-center gap-3">
          <span className="font-mono text-sm text-[--text-tertiary] line-through">{invite.code}</span>
          <span className="text-xs text-[--text-secondary]">
            {invite.claimed_by_email ?? 'Someone'}
            {' - '}
            {invite.claimed_at ? new Date(invite.claimed_at).toLocaleDateString() : 'Claimed'}
          </span>
        </div>
        <CheckIcon className="h-4 w-4 text-[--accent-success]" />
      </div>
    )
  }

  return (
    <>
      <div className="flex items-center justify-between rounded-[4px] border-2 border-[--border-subtle] bg-[--surface] px-3 py-2">
        <span className="font-mono text-sm font-semibold text-[--foreground]">{invite.code}</span>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => void handleCopyLink()}
            className="flex items-center gap-1"
          >
            {copiedLink ? <CheckIcon className="h-3.5 w-3.5" /> : <CopyIcon className="h-3.5 w-3.5" />}
            <span className="text-xs">{copiedLink ? 'Copied!' : 'Copy Link'}</span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowSendDialog(true)}
            className="flex items-center gap-1"
          >
            <MailIcon className="h-3.5 w-3.5" />
            <span className="text-xs">Send Invite</span>
          </Button>
        </div>
      </div>
      <SendInviteDialog
        invite={invite}
        open={showSendDialog}
        onClose={() => setShowSendDialog(false)}
      />
    </>
  )
}

export function PromotionsSection() {
  const { invites, isLoading } = useInvites()

  const availableInvites = invites.filter((inv) => !inv.claimed_by_user_id)
  const claimedInvites = invites.filter((inv) => !!inv.claimed_by_user_id)

  if (isLoading) {
    return (
      <FloatingCard
        floating="gentle"
        variant="elevated"
        className="space-y-4 border border-slate-200 bg-white/70 p-8 dark:border-slate-800 dark:bg-slate-900/60"
      >
        <Heading as="h2" size="section">Invites</Heading>
        <div className="animate-pulse space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-12 rounded-lg bg-slate-200 dark:bg-slate-700" />
          ))}
        </div>
      </FloatingCard>
    )
  }

  return (
    <FloatingCard
      floating="gentle"
      variant="elevated"
      className="space-y-6 border border-slate-200 bg-white/70 p-8 dark:border-slate-800 dark:bg-slate-900/60"
    >
      <div>
        <Heading as="h2" size="section">Invites</Heading>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Share your invite link to help friends join Hissuno.
        </p>
      </div>

      {/* Available Invites */}
      <div className="space-y-3">
        <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-[--text-tertiary]">
          Your Invites ({availableInvites.length} available)
        </p>
        {availableInvites.length > 0 ? (
          <div className="space-y-2">
            {availableInvites.map((invite) => (
              <InviteRow key={invite.id} invite={invite} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-[--text-secondary]">No invites available.</p>
        )}
      </div>

      {/* Claimed Invites */}
      {claimedInvites.length > 0 && (
        <div className="space-y-3">
          <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-[--text-tertiary]">
            Claimed Invites
          </p>
          <div className="space-y-2">
            {claimedInvites.map((invite) => (
              <InviteRow key={invite.id} invite={invite} />
            ))}
          </div>
        </div>
      )}

    </FloatingCard>
  )
}
