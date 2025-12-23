import { ChangePasswordForm } from '@/components/account/change-password-form'
import { IntegrationsSection } from '@/components/account/integrations-section'
import { getSessionUser } from '@/lib/auth/server'

export default async function AccountSettingsPage() {
  const user = await getSessionUser()

  return (
    <div className="grid gap-8 lg:grid-cols-[2fr,3fr]">
      <div className="space-y-8">
        <section className="space-y-4 rounded-3xl border border-slate-200 bg-white/70 p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Profile</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Manage how Hissuno recognizes you across projects.
          </p>
          <div className="rounded-2xl bg-slate-100/70 p-4 text-sm text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
            <div className="flex items-center justify-between">
              <span className="font-medium text-slate-700 dark:text-slate-100">Email</span>
              <span>{user?.email ?? 'Unknown'}</span>
            </div>
          </div>
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 p-6 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-400">
            <p className="font-medium text-slate-700 dark:text-slate-200">Preferences</p>
            <p className="mt-2">
              Personalization options are coming soon. You will be able to update themes, notification preferences, and default project views here.
            </p>
          </div>
        </section>
        <section className="space-y-4 rounded-3xl border border-slate-200 bg-white/70 p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Integrations</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Connect external services to enhance your workflow.
            </p>
          </div>
          <IntegrationsSection />
        </section>
      </div>
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
