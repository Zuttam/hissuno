'use server'

import { revalidatePath } from 'next/cache'
import { isRedirectError } from 'next/dist/client/components/redirect-error'
import { redirect } from 'next/navigation'
import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { signIn, signOut, BCRYPT_ROUNDS } from '@/lib/auth/auth'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema/auth'
import { getSessionUser } from '@/lib/auth/server'

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

  try {
    await signIn('credentials', {
      email,
      password,
      redirect: false,
    })
  } catch (err) {
    // AuthJS throws CredentialsSignin for invalid credentials
    const errType = (err as Record<string, unknown>)?.type ?? (err as Error)?.name ?? ''
    if (errType === 'CredentialsSignin') {
      return { error: 'Invalid email or password.' }
    }
    // Re-throw redirect errors
    if (isRedirectError(err)) throw err
    console.error('[auth.login] Sign in error:', err)
    return { error: 'An unexpected error occurred.' }
  }

  await refreshAuthDependentPaths()
  redirect(redirectTo)
}


export async function signOutAction() {
  await signOut({ redirect: false })
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

  // Verify current password via bcrypt
  const [dbUser] = await db
    .select({ password_hash: users.password_hash })
    .from(users)
    .where(eq(users.email, user.email))
    .limit(1)

  if (!dbUser?.password_hash) {
    return { error: 'Password change is not available for OAuth-only accounts.' }
  }

  const isCurrentValid = await bcrypt.compare(currentPassword, dbUser.password_hash)
  if (!isCurrentValid) {
    return { error: 'Current password is incorrect.' }
  }

  // Update password
  const newHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS)
  await db
    .update(users)
    .set({ password_hash: newHash, updated_at: new Date() })
    .where(eq(users.email, user.email))

  return { success: 'Password updated successfully.' }
}
