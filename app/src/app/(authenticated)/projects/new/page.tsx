import Link from 'next/link'
import { ProjectCreateForm } from '@/components/projects/project-create-form'

export default function NewProjectPage() {
  return (
    <div className="bg-[color:var(--background)] px-6 py-10">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-10">
        <nav className="font-mono text-sm text-[color:var(--text-secondary)]">
          <Link href="/" className="hover:text-[color:var(--foreground)]">
            ← Back to projects
          </Link>
        </nav>
        <ProjectCreateForm />
      </div>
    </div>
  )
}
