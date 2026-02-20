import { ChangePasswordForm } from '@/components/account/change-password-form'
import { NotificationPreferencesSection } from '@/components/account/notification-preferences-section'
import { ProfileSection } from '@/components/account/profile-section'
import { PageHeader } from '@/components/ui'
import { Card } from '@/components/ui/card'
import { getSessionUser } from '@/lib/auth/server'

export default async function AccountSettingsPage() {
  const user = await getSessionUser()

  return (
    <div className="mx-auto w-full max-w-6xl ">
      <div className="my-8">
      <PageHeader title="Account Settings" />
      </div>

      <div className="flex flex-col gap-8">
        <ProfileSection email={user?.email} />
        <NotificationPreferencesSection />
        <Card
          className="space-y-4 border border-slate-200 bg-white/70 p-8 dark:border-slate-800 dark:bg-slate-900/60"
        >
          <ChangePasswordForm />
        </Card>
      </div>
    </div>
  )
}
