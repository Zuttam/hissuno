'use client'

import { useState, useCallback, useMemo } from 'react'
import { Button, Heading, Dialog, Input } from '@/components/ui'
import { FloatingCard } from '@/components/ui/floating-card'
import { useInvites } from '@/hooks/use-invites'
import type { InviteWithClaimInfo } from '@/types/invites'

function CopyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184" />
    </svg>
  )
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 13l4 4L19 7" />
    </svg>
  )
}

function MailIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
    </svg>
  )
}

function LinkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  )
}

interface SendInviteDialogProps {
  invite: InviteWithClaimInfo
  open: boolean
  onClose: () => void
  onSent?: () => void
}

function SendInviteDialog({ invite, open, onClose, onSent }: SendInviteDialogProps) {
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
      onSent?.()
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
  }, [email, invite.id, onClose, onSent])

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

function ClickToCopy({ text, children }: { text: string; children: React.ReactNode }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // ignore
    }
  }, [text])

  return (
    <button
      type="button"
      onClick={() => void handleCopy()}
      className="group inline-flex items-center gap-1 rounded-[4px] transition hover:bg-[color:var(--surface-hover)]"
      title={copied ? 'Copied!' : `Copy "${text}"`}
    >
      {children}
      {copied ? (
        <CheckIcon className="h-3 w-3 text-[color:var(--accent-success)]" />
      ) : (
        <CopyIcon className="h-3 w-3 text-[color:var(--text-tertiary)] opacity-0 transition group-hover:opacity-100" />
      )}
    </button>
  )
}

interface InviteRowProps {
  invite: InviteWithClaimInfo
  onRefresh: () => void
}

function InviteRow({ invite, onRefresh }: InviteRowProps) {
  const [copiedLink, setCopiedLink] = useState(false)
  const [showSendDialog, setShowSendDialog] = useState(false)

  const inviteLink = typeof window !== 'undefined'
    ? `${window.location.origin}/sign-up?invite=${invite.code}`
    : `https://hissuno.com/sign-up?invite=${invite.code}`

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

  return (
    <>
      <tr className={`border-b border-[color:var(--border-subtle)] ${isClaimed ? 'opacity-50' : 'hover:bg-[color:var(--surface-hover)]'}`}>
        {/* Code */}
        <td className="px-3 py-2">
          {isClaimed ? (
            <span className="font-mono text-sm text-[color:var(--text-tertiary)] line-through">{invite.code}</span>
          ) : (
            <ClickToCopy text={invite.code}>
              <span className="font-mono text-sm font-semibold text-[color:var(--foreground)]">{invite.code}</span>
            </ClickToCopy>
          )}
        </td>

        {/* Sent To / Claimed By */}
        <td className="px-3 py-2">
          {invite.target_email ? (
            <span className="text-sm text-[color:var(--text-secondary)]">{invite.target_email}</span>
          ) : isClaimed && invite.claimed_by_email ? (
            <span className="text-sm text-[color:var(--text-secondary)]">{invite.claimed_by_email}</span>
          ) : (
            <span className="text-sm text-[color:var(--text-tertiary)]">-</span>
          )}
        </td>

        {/* Promotion */}
        <td className="px-3 py-2">
          {invite.promotion_code ? (
            <div className="flex items-center gap-1.5">
              <ClickToCopy text={invite.promotion_code}>
                <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[11px] font-semibold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                  {invite.promotion_code}
                </span>
              </ClickToCopy>
              {invite.promotion_description && (
                <span className="text-xs text-[color:var(--text-tertiary)]">{invite.promotion_description}</span>
              )}
            </div>
          ) : (
            <span className="text-sm text-[color:var(--text-tertiary)]">-</span>
          )}
        </td>

        {/* Status */}
        <td className="px-3 py-2">
          {isClaimed ? (
            <div className="flex flex-col">
              <span className="text-xs text-[color:var(--text-secondary)]">Claimed</span>
              {invite.claimed_at && (
                <span className="text-[11px] text-[color:var(--text-tertiary)]">{new Date(invite.claimed_at).toLocaleDateString()}</span>
              )}
            </div>
          ) : (
            <span className="text-xs text-[color:var(--accent-success)]">Available</span>
          )}
        </td>

        {/* Actions */}
        <td className="px-3 py-2">
          {!isClaimed && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => void handleCopyLink()}
                className="inline-flex items-center gap-1.5 rounded-[4px] px-2 py-1 text-xs text-[color:var(--text-secondary)] transition hover:bg-[color:var(--surface-hover)]"
              >
                {copiedLink ? (
                  <CheckIcon className="h-3.5 w-3.5 text-[color:var(--accent-success)]" />
                ) : (
                  <LinkIcon className="h-3.5 w-3.5" />
                )}
                <span>{copiedLink ? 'Copied!' : 'Link'}</span>
              </button>
              <button
                type="button"
                onClick={() => setShowSendDialog(true)}
                className="inline-flex items-center gap-1.5 rounded-[4px] px-2 py-1 text-xs text-[color:var(--text-secondary)] transition hover:bg-[color:var(--surface-hover)]"
              >
                <MailIcon className="h-3.5 w-3.5" />
                <span>Send</span>
              </button>
            </div>
          )}
        </td>
      </tr>

      <SendInviteDialog
        invite={invite}
        open={showSendDialog}
        onClose={() => setShowSendDialog(false)}
        onSent={onRefresh}
      />
    </>
  )
}

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <Button
      variant="ghost"
      size="sm"
      selected={active}
      onClick={onClick}
      className="!rounded-full !px-2.5 !py-0.5 !text-[10px]"
    >
      {label}
    </Button>
  )
}

function FilterLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="mr-1 font-mono text-[10px] uppercase text-[color:var(--text-tertiary)]">
      {children}
    </span>
  )
}

export function ReferralsSection() {
  const { invites, isLoading, refresh } = useInvites()
  const [showClaimed, setShowClaimed] = useState(false)
  const [showAvailable, setShowAvailable] = useState(true)
  const [sentFilter, setSentFilter] = useState<'sent' | 'not_sent' | undefined>()
  const [promoFilter, setPromoFilter] = useState<'with_promo' | 'no_promo' | undefined>()

  const filteredInvites = useMemo(() => {
    let result = invites

    // Status filter
    if (showAvailable && !showClaimed) {
      result = result.filter((inv) => !inv.claimed_by_user_id)
    } else if (showClaimed && !showAvailable) {
      result = result.filter((inv) => !!inv.claimed_by_user_id)
    }
    // Both active or neither active → show all

    // Sent filter
    if (sentFilter === 'sent') {
      result = result.filter((inv) => !!inv.target_email)
    } else if (sentFilter === 'not_sent') {
      result = result.filter((inv) => !inv.target_email)
    }

    // Promotion filter
    if (promoFilter === 'with_promo') {
      result = result.filter((inv) => !!inv.promotion_code)
    } else if (promoFilter === 'no_promo') {
      result = result.filter((inv) => !inv.promotion_code)
    }

    return result
  }, [invites, showAvailable, showClaimed, sentFilter, promoFilter])

  const isNonDefault = !showAvailable || showClaimed || !!sentFilter || !!promoFilter

  const handleClearFilters = useCallback(() => {
    setShowAvailable(true)
    setShowClaimed(false)
    setSentFilter(undefined)
    setPromoFilter(undefined)
  }, [])

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
            <div key={i} className="h-8 rounded bg-slate-200 dark:bg-slate-700" />
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

      {invites.length > 0 ? (
        <>
          <div className="flex flex-wrap items-center gap-1.5">
            <FilterLabel>Status:</FilterLabel>
            <FilterChip label="Available" active={showAvailable} onClick={() => setShowAvailable((v) => !v)} />
            <FilterChip label="Claimed" active={showClaimed} onClick={() => setShowClaimed((v) => !v)} />
            <span className="ml-2" />
            <FilterLabel>Sent:</FilterLabel>
            <FilterChip label="Sent" active={sentFilter === 'sent'} onClick={() => setSentFilter((v) => v === 'sent' ? undefined : 'sent')} />
            <FilterChip label="Not Sent" active={sentFilter === 'not_sent'} onClick={() => setSentFilter((v) => v === 'not_sent' ? undefined : 'not_sent')} />
            <span className="ml-2" />
            <FilterLabel>Promo:</FilterLabel>
            <FilterChip label="With Promo" active={promoFilter === 'with_promo'} onClick={() => setPromoFilter((v) => v === 'with_promo' ? undefined : 'with_promo')} />
            <FilterChip label="No Promo" active={promoFilter === 'no_promo'} onClick={() => setPromoFilter((v) => v === 'no_promo' ? undefined : 'no_promo')} />
            {isNonDefault && (
              <>
                <span className="ml-2" />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearFilters}
                  className="!rounded-full !px-2.5 !py-0.5 !text-[10px]"
                >
                  Reset
                </Button>
              </>
            )}
          </div>

          <div className="overflow-hidden rounded-[4px] border border-[color:var(--border-subtle)] bg-[color:var(--background)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[color:var(--border-subtle)] bg-[color:var(--surface)]">
                  <th className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wider text-[color:var(--text-secondary)]">Code</th>
                  <th className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wider text-[color:var(--text-secondary)]">Recipient</th>
                  <th className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wider text-[color:var(--text-secondary)]">Promotion</th>
                  <th className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wider text-[color:var(--text-secondary)]">Status</th>
                  <th className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wider text-[color:var(--text-secondary)]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvites.length > 0 ? (
                  filteredInvites.map((invite) => (
                    <InviteRow key={invite.id} invite={invite} onRefresh={refresh} />
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-sm text-[color:var(--text-tertiary)]">
                      No invites match the current filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <p className="text-sm text-[--text-secondary]">No invites available at this time. Check in later to help spread the word.</p>
      )}
    </FloatingCard>
  )
}
