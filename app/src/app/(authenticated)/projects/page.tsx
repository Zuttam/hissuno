import { ProjectsRedirect } from '@/components/projects/projects-redirect'
import { listProjects } from '@/lib/db/queries/projects'
import { getSessionUser } from '@/lib/auth/server'

export default async function ProjectsIndexPage() {
  const user = await getSessionUser()
  const projects = await listProjects(user!.id)
  return <ProjectsRedirect initialProjects={projects} />
}
