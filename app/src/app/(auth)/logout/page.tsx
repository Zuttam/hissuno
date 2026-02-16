import { signOutAction } from '@/lib/auth/actions'

export default async function LogoutPage() {
  await signOutAction()
}
