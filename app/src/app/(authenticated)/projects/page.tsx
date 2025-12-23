import { DeveloperProjects } from '@/components/projects/developer-projects'
import { listProjects } from '@/lib/projects/queries'

export default async function ProjectsIndexPage() {
  const projects = await listProjects()
  return <DeveloperProjects initialProjects={projects} />
}
