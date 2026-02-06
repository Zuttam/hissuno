'use server'

import { revalidatePath } from 'next/cache'
import { isRedirectError } from 'next/dist/client/components/redirect-error'
import { redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getSessionUser } from '@/lib/auth/server'
import { sendWelcomeNotificationIfNeeded } from '@/lib/notifications/welcome-notifications'
import { validateInviteCode, claimInvite } from '@/lib/invites/invite-service'

export type AuthActionState = {
  error?: string
  success?: string
}

function sanitizeRedirect(target: string | null | undefined) {
  if (!target || typeof target !== 'string') {
    return '/'
  }

  if (!target.startsWith('/')) {
    return '/'
  }

  return target
}

async function refreshAuthDependentPaths() {
  revalidatePath('/', 'layout')
  revalidatePath('/projects', 'page')
}

export async function loginAction(
  _prevState: AuthActionState | undefined,
  formData: FormData
): Promise<AuthActionState> {
  const email = formData.get('email')?.toString().trim().toLowerCase() ?? ''
  const password = formData.get('password')?.toString() ?? ''
  const redirectTo = sanitizeRedirect(formData.get('redirectTo') as string | null)

  if (!email || !password) {
    return { error: 'Please provide both email and password.' }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return { error: error.message }
  }

  // Send welcome email for email/password users (fire and forget)
  const user = data?.user
  if (user?.email) {
    const fullName = user.user_metadata?.full_name ?? user.user_metadata?.name
    sendWelcomeNotificationIfNeeded(user.id, user.email, fullName).catch((err) => {
      console.error('[auth.login] Failed to send welcome email:', err)
    })
  }

  await refreshAuthDependentPaths()
  redirect(redirectTo)
}

export async function signUpAction(
  _prevState: AuthActionState | undefined,
  formData: FormData
): Promise<AuthActionState> {
  const email = formData.get('email')?.toString().trim().toLowerCase() ?? ''
  const password = formData.get('password')?.toString() ?? ''
  const confirmPassword = formData.get('confirmPassword')?.toString() ?? ''
  const inviteCode = formData.get('inviteCode')?.toString().trim() ?? ''

  // Validate invite code first
  if (!inviteCode) {
    return { error: 'An invite code is required to sign up.' }
  }

  const inviteValidation = await validateInviteCode(inviteCode)
  if (!inviteValidation.valid) {
    return { error: inviteValidation.error ?? 'Invalid invite code.' }
  }

  if (!email || !password || !confirmPassword) {
    return { error: 'Fill in email, password, and confirmation.' }
  }

  if (password !== confirmPassword) {
    return { error: 'Passwords do not match.' }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  })

  if (error) {
    return { error: error.message }
  }

  // Supabase returns a user with empty identities when the email already exists
  // but is unverified. Detect this and verify + sign in the user directly.
  const isExistingUnverified =
    data.user && (!data.user.identities || data.user.identities.length === 0)

  if (isExistingUnverified) {
    try {
      const adminClient = createAdminClient()

      // Verify the user via admin API and update their password
      const { error: updateError } = await adminClient.auth.admin.updateUserById(data.user!.id, {
        email_confirm: true,
        password,
      })

      if (updateError) {
        console.error('[auth.signUp] Failed to verify existing user:', updateError)
        return { error: 'Failed to activate account. Please try again.' }
      }

      // Claim the invite
      if (inviteValidation.code) {
        try {
          await claimInvite(inviteValidation.code, data.user!.id)
        } catch (claimError) {
          console.error('[auth.signUp] Failed to claim invite for existing user:', claimError)
        }
      }

      // Sign the user in
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })

      if (signInError) {
        console.error('[auth.signUp] Failed to sign in verified user:', signInError)
        redirect(`/login?message=${encodeURIComponent('Account activated! Please sign in.')}`)
      }

      await refreshAuthDependentPaths()
      redirect('/onboarding?signup_completed=true')
    } catch (err) {
      // Re-throw Next.js redirect errors (redirect() throws internally)
      if (isRedirectError(err)) throw err
      console.error('[auth.signUp] Error handling existing unverified user:', err)
      return { error: 'Something went wrong. Please try again.' }
    }
  }

  // Normal new signup flow
  if (data.user && inviteValidation.code) {
    try {
      await claimInvite(inviteValidation.code, data.user.id)
    } catch (claimError) {
      // Log but don't fail signup - user is already created
      console.error('[auth.signUp] Failed to claim invite:', claimError)
    }
  }

  await refreshAuthDependentPaths()
  redirect(`/login?message=${encodeURIComponent('Check your email to confirm the account.')}`)
}

export async function signOutAction() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  await refreshAuthDependentPaths()
  redirect('/')
}

export async function updatePasswordAction(
  _prevState: AuthActionState | undefined,
  formData: FormData
): Promise<AuthActionState> {
  const user = await getSessionUser()
  if (!user?.email) {
    return { error: 'Unable to determine your account email.' }
  }

  const currentPassword = formData.get('currentPassword')?.toString() ?? ''
  const newPassword = formData.get('newPassword')?.toString() ?? ''
  const confirmPassword = formData.get('confirmPassword')?.toString() ?? ''

  if (!currentPassword || !newPassword || !confirmPassword) {
    return { error: 'Fill in all password fields.' }
  }

  if (newPassword.length < 8) {
    return { error: 'New password must be at least 8 characters long.' }
  }

  if (newPassword !== confirmPassword) {
    return { error: 'New passwords do not match.' }
  }

  const supabase = await createClient()

  const { error: reauthError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  })

  if (reauthError) {
    return { error: 'Current password is incorrect.' }
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword })

  if (error) {
    return { error: error.message }
  }

  return { success: 'Password updated successfully.' }
}
