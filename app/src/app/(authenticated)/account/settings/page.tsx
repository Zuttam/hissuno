import { ChangePasswordForm } from '@/components/account/change-password-form'
import { ProfileSection } from '@/components/account/profile-section'
import { getSessionUser } from '@/lib/auth/server'

export default async function AccountSettingsPage() {
  const user = await getSessionUser()

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr,1fr]">
      <ProfileSection email={user?.email} />
      <section className="space-y-4 rounded-3xl border border-slate-200 bg-white/70 p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Change password</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Update your password to keep your account secure.
          </p>
        </div>
        <ChangePasswordForm />
      </section>
    </div>
  )
}
