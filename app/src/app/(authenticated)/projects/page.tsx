import { Projects } from '@/components/projects/projects'
import { listProjects } from '@/lib/projects/queries'

export default async function ProjectsIndexPage() {
  const projects = await listProjects()
  return <Projects initialProjects={projects} />
}
