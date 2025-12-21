import { redirect } from 'next/navigation'

export default async function AuthenticatedHome() {
  return redirect('/projects')
}
