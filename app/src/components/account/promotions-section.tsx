'use client'

import { useState, useCallback } from 'react'
import { Button, Heading } from '@/components/ui'
import { FloatingCard } from '@/components/ui/floating-card'
import { useInvites } from '@/hooks/use-invites'
import { usePromotions } from '@/hooks/use-promotions'
import type { InviteWithClaimInfo, PromotionRecord } from '@/types/invites'

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

function GiftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 11.25v8.25a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 1 0 9.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1 1 14.625 7.5H12m0 0V21m-8.625-9.75h18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-18c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
    </svg>
  )
}

interface InviteRowProps {
  invite: InviteWithClaimInfo
}

function InviteRow({ invite }: InviteRowProps) {
  const [copiedLink, setCopiedLink] = useState(false)
  const [copiedCode, setCopiedCode] = useState(false)

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

  const handleCopyCode = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(invite.code)
      setCopiedCode(true)
      setTimeout(() => setCopiedCode(false), 2000)
    } catch {
      console.error('Failed to copy code')
    }
  }, [invite.code])

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
          onClick={() => void handleCopyCode()}
          className="flex items-center gap-1"
        >
          {copiedCode ? <CheckIcon className="h-3.5 w-3.5" /> : <CopyIcon className="h-3.5 w-3.5" />}
          <span className="text-xs">{copiedCode ? 'Copied!' : 'Copy Code'}</span>
        </Button>
      </div>
    </div>
  )
}

function formatPromotionValue(promotion: PromotionRecord): string {
  switch (promotion.type) {
    case 'referral_credit':
      return `$${(promotion.value / 100).toFixed(2)} credit`
    case 'discount_percent':
      return `${promotion.value}% discount`
    case 'free_month':
      return `${promotion.value} free month${promotion.value > 1 ? 's' : ''}`
    default:
      return 'Reward'
  }
}

function formatPromotionStatus(status: PromotionRecord['status']): string {
  switch (status) {
    case 'pending':
      return 'Pending'
    case 'eligible':
      return 'Eligible'
    case 'claimed':
      return 'Claimed'
    case 'expired':
      return 'Expired'
    default:
      return status
  }
}

function getStatusColor(status: PromotionRecord['status']): string {
  switch (status) {
    case 'pending':
      return 'text-[--text-secondary]'
    case 'eligible':
      return 'text-[--accent-success]'
    case 'claimed':
      return 'text-[--accent-info]'
    case 'expired':
      return 'text-[--text-tertiary]'
    default:
      return 'text-[--text-secondary]'
  }
}

interface PromotionRowProps {
  promotion: PromotionRecord
}

function PromotionRow({ promotion }: PromotionRowProps) {
  return (
    <div className="flex items-center justify-between rounded-[4px] border-2 border-[--border-subtle] bg-[--surface] px-3 py-2">
      <div className="flex items-center gap-3">
        <GiftIcon className="h-4 w-4 text-[--text-secondary]" />
        <span className="text-sm text-[--foreground]">{formatPromotionValue(promotion)}</span>
      </div>
      <span className={`text-xs font-medium ${getStatusColor(promotion.status)}`}>
        {formatPromotionStatus(promotion.status)}
      </span>
    </div>
  )
}

export function PromotionsSection() {
  const { invites, isLoading: invitesLoading } = useInvites()
  const { promotions, isLoading: promotionsLoading } = usePromotions()

  const isLoading = invitesLoading || promotionsLoading

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
          Share your invite link to help friends join and earn rewards.
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

      {/* Earned Rewards */}
      {promotions.length > 0 && (
        <div className="space-y-3">
          <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-[--text-tertiary]">
            Earned Rewards
          </p>
          <div className="space-y-2">
            {promotions.map((promotion) => (
              <PromotionRow key={promotion.id} promotion={promotion} />
            ))}
          </div>
        </div>
      )}
    </FloatingCard>
  )
}
