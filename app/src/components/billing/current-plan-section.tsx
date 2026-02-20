'use client'

import type { Subscription, Plan } from '@/types/billing'
import { Card } from '@/components/ui/card'
import { Heading } from '@/components/ui'

interface CurrentPlanSectionProps {
  subscription: Subscription | null
  plan: Plan | null
  customerPortalUrl: string | null
}

export function CurrentPlanSection({
  subscription,
  plan,
  customerPortalUrl,
}: CurrentPlanSectionProps) {
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'N/A'
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const formatPrice = (cents: number) => {
    if (cents === 0) return 'Free'
    return `$${(cents / 100).toFixed(0)}/mo`
  }

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      cancelled: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
      expired: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
      past_due: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
      on_trial: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
      paused: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
    }
    return styles[status] ?? styles.active
  }

  const formatStatus = (status: string) => {
    return status.replace('_', ' ').toUpperCase()
  }

  return (
    <Card
      className="space-y-4 border border-slate-200 bg-white/70 p-8 dark:border-slate-800 dark:bg-slate-900/60"
    >
      <div>
        <Heading as="h2" size="section">Current Plan</Heading>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Your active subscription details.
        </p>
      </div>

      {plan ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-slate-50">
                {plan.display_name}
              </h3>
              <p className="text-2xl font-bold text-slate-700 dark:text-slate-200">
                {formatPrice(plan.price_cents)}
              </p>
            </div>
            {subscription && (
              <span
                className={`rounded-full px-3 py-1 text-xs font-medium ${getStatusBadge(subscription.status)}`}
              >
                {formatStatus(subscription.status)}
              </span>
            )}
          </div>

          {subscription?.current_period_end && (
            <div className="rounded-2xl bg-slate-100/70 p-4 text-sm dark:bg-slate-800/60">
              <div className="flex justify-between">
                <span className="text-slate-600 dark:text-slate-400">
                  {subscription.status === 'on_trial' ? 'Trial ends' : 'Next billing date'}
                </span>
                <span className="font-medium text-slate-900 dark:text-slate-100">
                  {formatDate(subscription.current_period_end)}
                </span>
              </div>
            </div>
          )}

          {customerPortalUrl && (
            <a
              href={customerPortalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              Manage Subscription
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                />
              </svg>
            </a>
          )}
        </div>
      ) : subscription ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-slate-50">
                {subscription.plan_name.charAt(0).toUpperCase() + subscription.plan_name.slice(1)}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">Custom plan</p>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${getStatusBadge(subscription.status)}`}
            >
              {formatStatus(subscription.status)}
            </span>
          </div>

          {subscription.current_period_end && (
            <div className="rounded-2xl bg-slate-100/70 p-4 text-sm dark:bg-slate-800/60">
              <div className="flex justify-between">
                <span className="text-slate-600 dark:text-slate-400">
                  {subscription.status === 'on_trial' ? 'Trial ends' : 'Next billing date'}
                </span>
                <span className="font-medium text-slate-900 dark:text-slate-100">
                  {formatDate(subscription.current_period_end)}
                </span>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 p-6 text-center dark:border-slate-700 dark:bg-slate-800/40">
          <p className="text-slate-500 dark:text-slate-400">
            You are currently on the free tier.
          </p>
          <p className="mt-1 text-sm text-slate-400 dark:text-slate-500">
            Upgrade to unlock more features.
          </p>
        </div>
      )}
    </Card>
  )
}
