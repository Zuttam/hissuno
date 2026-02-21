import { NotificationPreferencesSection } from '@/components/account/notification-preferences-section'
import { PageHeader } from '@/components/ui'

export default function NotificationSettingsPage() {
  return (
    <div className="mx-auto w-full max-w-6xl ">
      <div className="my-8">
        <PageHeader title="Notification Settings" />
      </div>

      <div className="flex flex-col gap-8">
        <NotificationPreferencesSection />
      </div>
    </div>
  )
}
