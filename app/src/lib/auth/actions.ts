'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getSessionUser } from '@/lib/auth/server'
import { sendWelcomeNotificationIfNeeded } from '@/lib/notifications/welcome-notifications'

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

  if (!email || !password || !confirmPassword) {
    return { error: 'Fill in email, password, and confirmation.' }
  }

  if (password !== confirmPassword) {
    return { error: 'Passwords do not match.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signUp({
    email,
    password,
  })

  if (error) {
    return { error: error.message }
  }

  await refreshAuthDependentPaths()
  redirect(`/login?message=${encodeURIComponent('Check your email to confirm the account.')}`)
}

export async function signOutAction() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  await refreshAuthDependentPaths()
  redirect('/login')
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
