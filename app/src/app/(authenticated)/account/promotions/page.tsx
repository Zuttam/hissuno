import { PageHeader } from '@/components/ui'
import { PromotionsSection } from '@/components/account/promotions-section'

export default function AccountPromotionsPage() {
  return (
    <div className="mx-auto w-full max-w-6xl">
      <div className="my-8">
        <PageHeader title="Invites" />
      </div>

      <div className="flex flex-col gap-8">
        <PromotionsSection />
      </div>
    </div>
  )
}
