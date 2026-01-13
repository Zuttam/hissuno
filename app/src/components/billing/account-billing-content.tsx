'use client'

import { useState, useCallback, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import type { BillingInfo, Plan } from '@/types/billing'
import { IconButton } from '@/components/ui/icon-button'
import { RefreshIcon } from '@/components/ui/refresh-icon'
import { Heading } from '@/components/ui'
import { CurrentPlanSection } from './current-plan-section'
import { UsageSection } from './usage-section'
import { PlansSection } from './plans-section'

interface AccountBillingContentProps {
  initialBillingInfo: BillingInfo
  plans: Plan[]
}

export function AccountBillingContent({ initialBillingInfo, plans }: AccountBillingContentProps) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [billingInfo, setBillingInfo] = useState(initialBillingInfo)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [checkoutStatus, setCheckoutStatus] = useState<'success' | 'cancelled' | null>(null)

  const refreshBillingInfo = useCallback(async () => {
    setIsRefreshing(true)
    try {
      const response = await fetch('/api/billing/info')
      const data = await response.json()
      if (data.billingInfo) {
        setBillingInfo(data.billingInfo)
      }
    } catch (error) {
      console.error('Failed to refresh billing info:', error)
    } finally {
      setIsRefreshing(false)
    }
  }, [])

  // Handle checkout callback query params
  useEffect(() => {
    const checkout = searchParams.get('checkout')
    if (checkout === 'success') {
      setCheckoutStatus('success')
      // Refresh billing info to get updated subscription
      void refreshBillingInfo()
      // Clear query param from URL
      router.replace('/account/billing', { scroll: false })
      // Auto-dismiss after 5 seconds
      const timer = setTimeout(() => setCheckoutStatus(null), 5000)
      return () => clearTimeout(timer)
    } else if (checkout === 'cancelled') {
      setCheckoutStatus('cancelled')
      router.replace('/account/billing', { scroll: false })
      const timer = setTimeout(() => setCheckoutStatus(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [searchParams, router, refreshBillingInfo])

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Heading as="h1" size="page">Billing & Usage</Heading>
          <IconButton
            aria-label="Refresh billing info"
            variant="ghost"
            size="md"
            onClick={() => void refreshBillingInfo()}
            disabled={isRefreshing}
          >
            <RefreshIcon />
          </IconButton>
        </div>
      </div>

      {checkoutStatus && (
        <div
          className={`rounded-lg border px-4 py-3 ${
            checkoutStatus === 'success'
              ? 'border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-900/20 dark:text-green-200'
              : 'border-slate-200 bg-slate-50 text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">
              {checkoutStatus === 'success'
                ? 'Payment successful! Your subscription has been updated.'
                : 'Checkout was cancelled. No changes were made to your subscription.'}
            </p>
            <button
              onClick={() => setCheckoutStatus(null)}
              className="ml-4 text-current opacity-70 hover:opacity-100"
              aria-label="Dismiss"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-2">
        <CurrentPlanSection
          subscription={billingInfo.subscription}
          plan={billingInfo.plan}
          customerPortalUrl={billingInfo.customerPortalUrl}
        />
        <UsageSection usage={billingInfo.usage} />
      </div>

      <PlansSection
        plans={plans}
        currentPlanId={billingInfo.subscription?.plan_id ?? null}
        onPlanChange={refreshBillingInfo}
      />
    </div>
  )
}
