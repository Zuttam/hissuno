import { signOut } from '@/lib/auth/auth'

export const runtime = 'nodejs'

export async function GET() {
  await signOut({ redirectTo: '/login' })
}
