import { ProjectsRedirect } from '@/components/projects/projects-redirect'
import { listProjects } from '@/lib/supabase/projects'

export default async function ProjectsIndexPage() {
  const projects = await listProjects()
  return <ProjectsRedirect initialProjects={projects} />
}
