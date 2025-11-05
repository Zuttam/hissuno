import { DeveloperDashboard } from '@/components/projects/dashboard'
import { listProjects } from '@/lib/supabase/projects'

export default async function Home() {
  const projects = await listProjects()

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <DeveloperDashboard initialProjects={projects} />
    </main>
  )
}
