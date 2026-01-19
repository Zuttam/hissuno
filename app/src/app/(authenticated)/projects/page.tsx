import { Projects } from '@/components/projects/projects'
import { listProjects } from '@/lib/supabase/projects'

export default async function ProjectsIndexPage() {
  const projects = await listProjects()
  return <Projects initialProjects={projects} />
}
