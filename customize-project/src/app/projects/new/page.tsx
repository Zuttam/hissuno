import Link from 'next/link'
import { ProjectCreateForm } from '@/components/projects/project-create-form'

export default function NewProjectPage() {
  return (
    <main className="min-h-screen bg-linear-to-br from-slate-50 via-white to-slate-100 px-6 py-10 dark:from-slate-900 dark:via-slate-950 dark:to-slate-900">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-10">
        <nav className="text-sm text-slate-500 dark:text-slate-400">
          <Link href="/" className="hover:text-slate-900 dark:hover:text-white">
            ← Back to projects
          </Link>
        </nav>
        <ProjectCreateForm />
      </div>
    </main>
  )
}

