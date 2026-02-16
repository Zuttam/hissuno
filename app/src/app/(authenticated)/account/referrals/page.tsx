import { PageHeader } from '@/components/ui'
import { ReferralsSection } from '@/components/account/referrals-section'

export default function AccountReferralsPage() {
  return (
    <div className="mx-auto w-full max-w-6xl">
      <div className="my-8">
        <PageHeader title="Referrals" />
      </div>

      <div className="flex flex-col gap-8">
        <ReferralsSection />
      </div>
    </div>
  )
}
