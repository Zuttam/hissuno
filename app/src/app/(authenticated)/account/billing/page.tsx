import Script from 'next/script'
import { getSessionUser } from '@/lib/auth/server'
import { isLemonSqueezyConfigured } from '@/lib/billing/lemon-squeezy'
import { getBillingInfo } from '@/lib/billing/billing-service'
import { getPlans } from '@/lib/billing/plans-cache'
import { BillingPageContent } from '@/components/billing/billing-page-content'

export default async function BillingSettingsPage() {
  const user = await getSessionUser()

  if (!user) {
    return null // Layout handles redirect
  }

  // Check if billing is configured
  if (!isLemonSqueezyConfigured()) {
    return (
      <div className="mx-auto w-full max-w-6xl">
        <div className="rounded-3xl border border-slate-200 bg-white/70 p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">
            Billing Not Configured
          </h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Billing is not configured for this environment. Please contact support if you believe
            this is an error.
          </p>
        </div>
      </div>
    )
  }

  const [billingInfo, plans] = await Promise.all([getBillingInfo(user.id), getPlans()])

  return (
    <div className="mx-auto w-full max-w-6xl">
      {/* Lemon Squeezy checkout overlay script */}
      <Script
        src="https://assets.lemonsqueezy.com/lemon.js"
        strategy="lazyOnload"
      />
      <BillingPageContent initialBillingInfo={billingInfo} plans={plans} />
    </div>
  )
}
