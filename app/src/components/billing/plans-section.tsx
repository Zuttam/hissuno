'use client'

import { useState } from 'react'
import type { Plan } from '@/types/billing'
import { FloatingCard } from '@/components/ui/floating-card'
import { Button, Heading } from '@/components/ui'
import { cn } from '@/lib/utils/class'

interface PlansSectionProps {
  plans: Plan[]
  currentPlanId: string | null
  onPlanChange: () => void
}

export function PlansSection({ plans, currentPlanId, onPlanChange }: PlansSectionProps) {
  const [isLoading, setIsLoading] = useState<string | null>(null)

  const formatPrice = (cents: number) => {
    if (cents === 0) return 'Free'
    return `$${(cents / 100).toFixed(0)}/mo`
  }

  const handleSelectPlan = async (plan: Plan) => {
    if (plan.id === currentPlanId) return

    // Free plans can't be selected from here - they need to go through checkout for downgrades
    if (plan.price_cents === 0) {
      // For now, just show a message about using the customer portal
      return
    }

    setIsLoading(plan.id)
    try {
      const response = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: plan.id, redirectPath: '/account/billing' }),
      })
      const data = await response.json()

      if (data.checkoutUrl) {
        // Open Lemon Squeezy checkout
        if (
          typeof window !== 'undefined' &&
          (window as unknown as { LemonSqueezy?: { Url: { Open: (url: string) => void } } })
            .LemonSqueezy
        ) {
          ;(
            window as unknown as { LemonSqueezy: { Url: { Open: (url: string) => void } } }
          ).LemonSqueezy.Url.Open(data.checkoutUrl)
        } else {
          window.open(data.checkoutUrl, '_blank')
        }
      }
    } catch (error) {
      console.error('Failed to create checkout:', error)
    } finally {
      setIsLoading(null)
    }
  }

  return (
    <section className="space-y-4">
      <div>
        <Heading as="h2" size="section">Available Plans</Heading>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Compare plans and upgrade to unlock more features.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {plans.map((plan) => {
          const isCurrent = plan.id === currentPlanId
          const isLoadingThis = isLoading === plan.id

          return (
            <FloatingCard
              key={plan.id}
              floating="gentle"
              variant="elevated"
              className={cn(
                'relative flex flex-col border-2 p-6',
                isCurrent
                  ? 'border-blue-500 bg-blue-50/50 dark:border-blue-400 dark:bg-blue-900/20'
                  : 'border-slate-200 bg-white/70 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900/60 dark:hover:border-slate-600',
                plan.is_recommended && 'ring-2 ring-blue-500 dark:ring-blue-400'
              )}
            >
              {plan.is_recommended && (
                <span className="absolute -top-3 left-4 rounded-full bg-blue-500 px-3 py-1 text-xs font-medium text-white">
                  Recommended
                </span>
              )}

              <h3 className="text-xl font-bold text-slate-900 dark:text-slate-50">
                {plan.display_name}
              </h3>

              <div className="mt-2 text-3xl font-bold text-slate-900 dark:text-slate-50">
                {formatPrice(plan.price_cents)}
              </div>

              <ul className="mt-4 flex-1 space-y-2">
                {plan.features.map((feature, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400"
                  >
                    <svg
                      className="mt-0.5 h-4 w-4 shrink-0 text-green-500"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    {feature}
                  </li>
                ))}
              </ul>

              <Button
                variant={isCurrent || plan.price_cents === 0 ? 'ghost' : 'primary'}
                size="md"
                className="mt-6 w-full"
                onClick={() => handleSelectPlan(plan)}
                disabled={isCurrent || isLoadingThis || plan.price_cents === 0}
                loading={isLoadingThis}
              >
                {isCurrent
                  ? 'Current Plan'
                  : plan.price_cents === 0
                    ? 'Contact Support to Downgrade'
                    : 'Upgrade'}
              </Button>
            </FloatingCard>
          )
        })}
      </div>
    </section>
  )
}
