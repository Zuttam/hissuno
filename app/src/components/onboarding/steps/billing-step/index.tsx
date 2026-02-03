'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { FloatingCard } from '@/components/ui/floating-card'
import { Button, WizardStepHeader } from '@/components/ui'
import { cn } from '@/lib/utils/class'
import type { Plan } from '@/types/billing'
import type { StepProps, OnboardingFormData } from '../types'

const POLL_INTERVAL_MS = 3000
const POLL_MAX_ATTEMPTS = 20

export function BillingStep({ context, onValidationChange, onCheckoutComplete, title, description }: StepProps) {
  const { formData, setFormData } = context
  const onboardingData = formData as OnboardingFormData
  const router = useRouter()
  const searchParams = useSearchParams()

  const [plans, setPlans] = useState<Plan[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null)
  const [currentPlanId, setCurrentPlanId] = useState<string | null>(null)
  const [isPolling, setIsPolling] = useState(false)
  const [pollTimedOut, setPollTimedOut] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Validate when plan selection changes
  useEffect(() => {
    const isValid = !!onboardingData.billing?.selectedPlanId
    onValidationChange?.(isValid)
  }, [onValidationChange, onboardingData.billing?.selectedPlanId])

  // Fetch plans and check existing subscription on mount
  useEffect(() => {
    async function loadData() {
      try {
        const [plansRes, billingRes] = await Promise.all([
          fetch('/api/billing/plans'),
          fetch('/api/billing/info'),
        ])
        const plansData = await plansRes.json()
        setPlans(plansData.plans ?? [])

        if (billingRes.ok) {
          const billingData = await billingRes.json()
          const sub = billingData.billingInfo?.subscription
          if (sub && (sub.status === 'active' || sub.status === 'on_trial')) {
            setCurrentPlanId(sub.plan_id)
            // Pre-select existing subscription plan
            setFormData((prev) => {
              const onboarding = prev as OnboardingFormData
              if (!onboarding.billing?.selectedPlanId) {
                return {
                  ...onboarding,
                  billing: { selectedPlanId: sub.plan_id, skipped: false },
                }
              }
              return prev
            })
          }
        }
      } catch {
        // Plans fetch failed silently
      } finally {
        setIsLoading(false)
      }
    }

    void loadData()
  }, [setFormData])

  // Checkout return polling
  useEffect(() => {
    const isCheckoutReturn = searchParams.get('checkout') === 'success'
    if (!isCheckoutReturn) return

    setIsPolling(true)
    let attempts = 0

    pollRef.current = setInterval(async () => {
      attempts++
      try {
        const res = await fetch('/api/billing/info')
        if (res.ok) {
          const data = await res.json()
          const sub = data.billingInfo?.subscription
          if (sub && (sub.status === 'active' || sub.status === 'on_trial')) {
            // Subscription found
            setCurrentPlanId(sub.plan_id)
            setFormData((prev) => {
              const onboarding = prev as OnboardingFormData
              return {
                ...onboarding,
                billing: { selectedPlanId: sub.plan_id, skipped: false },
              }
            })
            setIsPolling(false)
            if (pollRef.current) clearInterval(pollRef.current)
            // Clean up URL
            router.replace('/onboarding', { scroll: false })
            // Auto-advance to next step
            onCheckoutComplete?.()
            return
          }
        }
      } catch {
        // Polling error, continue
      }

      if (attempts >= POLL_MAX_ATTEMPTS) {
        setIsPolling(false)
        setPollTimedOut(true)
        if (pollRef.current) clearInterval(pollRef.current)
        router.replace('/onboarding', { scroll: false })
      }
    }, POLL_INTERVAL_MS)

    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [searchParams, setFormData, router, onCheckoutComplete])

  const handleSelectPlan = useCallback(
    async (plan: Plan) => {
      if (plan.id === currentPlanId) return

      if (plan.price_cents === 0) {
        // Free plan - just select it
        setFormData((prev) => {
          const onboarding = prev as OnboardingFormData
          return {
            ...onboarding,
            billing: { selectedPlanId: plan.id, skipped: false },
          }
        })
      } else {
        // Paid plan - redirect to checkout
        setCheckoutLoading(plan.id)
        try {
          const response = await fetch('/api/billing/checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ planId: plan.id, redirectPath: '/onboarding' }),
          })
          const data = await response.json()
          if (data.checkoutUrl) {
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
          console.error('[billing-step] Failed to create checkout:', error)
        } finally {
          setCheckoutLoading(null)
        }
      }
    },
    [setFormData, currentPlanId]
  )

  const formatPrice = (cents: number) => {
    if (cents === 0) return 'Free'
    return `$${(cents / 100).toFixed(0)}/mo`
  }

  const getButtonLabel = (plan: Plan) => {
    if (plan.id === currentPlanId) return 'Current Plan'
    if (plan.price_cents === 0) return 'Start Free'
    return 'Select Plan'
  }

  // Polling state - show spinner
  if (isPolling) {
    return (
      <div>
        <WizardStepHeader title={title} description={description} />
        <div className="flex flex-col items-center justify-center gap-4 py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[--accent-primary] border-t-transparent" />
          <p className="text-sm text-[color:var(--text-secondary)]">
            Confirming your subscription...
          </p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <WizardStepHeader title={title} description={description} />

      {pollTimedOut && (
        <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
          We couldn&apos;t confirm your subscription yet, but it may still be processing. You can proceed and check your billing status later in account settings.
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[--accent-primary] border-t-transparent" />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          {plans.map((plan) => {
            const isCurrent = plan.id === currentPlanId
            const isSelected = onboardingData.billing?.selectedPlanId === plan.id
            const isLoadingThis = checkoutLoading === plan.id

            return (
              <FloatingCard
                key={plan.id}
                floating="gentle"
                variant="elevated"
                className={cn(
                  'relative flex flex-col border-2 p-6',
                  isSelected
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
                  variant={isCurrent ? 'ghost' : isSelected ? 'primary' : 'secondary'}
                  size="md"
                  className="mt-6 w-full"
                  onClick={() => handleSelectPlan(plan)}
                  disabled={isCurrent || isLoadingThis}
                  loading={isLoadingThis}
                >
                  {getButtonLabel(plan)}
                </Button>
              </FloatingCard>
            )
          })}
        </div>
      )}
    </div>
  )
}
