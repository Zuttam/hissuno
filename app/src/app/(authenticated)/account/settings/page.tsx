import { ChangePasswordForm } from '@/components/account/change-password-form'
import { ProfileSection } from '@/components/account/profile-section'
import { Heading } from '@/components/ui'
import { FloatingCard } from '@/components/ui/floating-card'
import { getSessionUser } from '@/lib/auth/server'

export default async function AccountSettingsPage() {
  const user = await getSessionUser()

  return (
    <div className="mx-auto w-full max-w-6xl pt-4">
      <div className="grid gap-8 lg:grid-cols-[1fr,1fr]">
        <ProfileSection email={user?.email} />
        <FloatingCard
          floating="gentle"
          variant="elevated"
          className="space-y-4 border border-slate-200 bg-white/70 p-8 dark:border-slate-800 dark:bg-slate-900/60"
        >
          <div>
            <Heading as="h2" size="section">Change Password</Heading>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Update your password to keep your account secure.
            </p>
          </div>
          <ChangePasswordForm />
        </FloatingCard>
      </div>
    </div>
  )
}
