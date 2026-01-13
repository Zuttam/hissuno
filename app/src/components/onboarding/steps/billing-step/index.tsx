'use client'

import { useCallback, useEffect, useState } from 'react'
import { WizardStepHeader } from '@/components/ui'
import type { StepProps, OnboardingFormData } from '../types'

interface Plan {
  id: string
  name: string
  display_name: string
  price_cents: number
  sessions_limit: number | null
  features: string[]
  is_recommended: boolean
}

export function BillingStep({ context, onValidationChange, title, description }: StepProps) {
  const { formData, setFormData } = context
  const onboardingData = formData as OnboardingFormData
  const [plans, setPlans] = useState<Plan[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Validate when plan selection changes
  useEffect(() => {
    const isValid = !!onboardingData.billing?.selectedPlanId
    onValidationChange?.(isValid)
  }, [onValidationChange, onboardingData.billing?.selectedPlanId])

  // Fetch plans
  useEffect(() => {
    fetch('/api/billing/plans')
      .then((res) => res.json())
      .then((data) => {
        setPlans(data.plans ?? [])
        setIsLoading(false)
      })
      .catch(() => {
        setIsLoading(false)
      })
  }, [])

  const handleSelectPlan = useCallback(
    async (plan: Plan) => {
      if (plan.price_cents === 0) {
        // Free plan - just select it
        setFormData((prev) => {
          const onboarding = prev as OnboardingFormData
          return {
            ...onboarding,
            billing: {
              selectedPlanId: plan.id,
              skipped: false,
            },
          }
        })
      } else {
        // Paid plan - redirect to checkout
        try {
          const response = await fetch('/api/billing/checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ planId: plan.id, redirectPath: '/onboarding' }),
          })
          const data = await response.json()
          if (data.checkoutUrl) {
            // Open Lemon Squeezy checkout overlay
            if (typeof window !== 'undefined' && (window as unknown as { LemonSqueezy?: { Url: { Open: (url: string) => void } } }).LemonSqueezy) {
              (window as unknown as { LemonSqueezy: { Url: { Open: (url: string) => void } } }).LemonSqueezy.Url.Open(data.checkoutUrl)
            } else {
              window.open(data.checkoutUrl, '_blank')
            }
          }
        } catch (error) {
          console.error('Failed to create checkout:', error)
        }
      }
    },
    [setFormData]
  )

  const formatPrice = (cents: number) => {
    if (cents === 0) return 'Free'
    return `$${(cents / 100).toFixed(0)}/mo`
  }

  return (
    <div>
      <WizardStepHeader title={title} description={description} />

      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[--accent-primary]" />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          {plans.map((plan) => (
            <button
              key={plan.id}
              type="button"
              onClick={() => handleSelectPlan(plan)}
              className={`relative flex flex-col rounded-lg border-2 p-4 text-left transition-all hover:border-[--accent-primary] ${
                onboardingData.billing?.selectedPlanId === plan.id
                  ? 'border-[--accent-selected] bg-[--accent-selected]/5'
                  : 'border-[--border-subtle]'
              } ${plan.is_recommended ? 'ring-2 ring-[--accent-primary]' : ''}`}
            >
              {plan.is_recommended && (
                <span className="absolute -top-2.5 left-4 bg-[--accent-primary] px-2 py-0.5 text-xs font-mono uppercase text-white rounded">
                  Recommended
                </span>
              )}
              <h3 className="font-mono text-lg font-bold text-[--foreground]">
                {plan.display_name}
              </h3>
              <div className="mt-2 text-2xl font-bold text-[--foreground]">
                {formatPrice(plan.price_cents)}
              </div>
              <ul className="mt-4 space-y-2 flex-1">
                {plan.features.map((feature, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-sm text-[--text-secondary]"
                  >
                    <svg
                      className="h-4 w-4 shrink-0 text-green-500 mt-0.5"
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
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
