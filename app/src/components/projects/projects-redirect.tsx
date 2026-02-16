'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useProject } from '@/components/providers/project-provider'
import { useProjects } from '@/hooks/use-projects'
import type { ProjectRecord } from '@/lib/supabase/projects'

interface ProjectsRedirectProps {
  initialProjects: ProjectRecord[]
}

export function ProjectsRedirect({ initialProjects }: ProjectsRedirectProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { projectId, setProjectId, isLoading: isProjectLoading } = useProject()
  const { projects, isLoading: isProjectsLoading } = useProjects(initialProjects)
  const [isAccepting, setIsAccepting] = useState(false)
  const acceptAttempted = useRef(false)

  const acceptInviteParam = searchParams.get('acceptInvite')

  const handleAcceptInvite = useCallback(async (memberId: string) => {
    if (acceptAttempted.current) return
    acceptAttempted.current = true
    setIsAccepting(true)

    try {
      const response = await fetch('/api/projects/members/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId }),
      })

      if (response.ok) {
        const data = await response.json()
        if (data.projectId) {
          setProjectId(data.projectId)
          router.replace(`/projects/${data.projectId}/dashboard`)
          return
        }
      }

      console.error('[projects-redirect] Failed to accept invite')
    } catch (err) {
      console.error('[projects-redirect] Error accepting invite:', err)
    }

    // Fallback: continue with normal redirect logic
    setIsAccepting(false)
  }, [router, setProjectId])

  // Handle acceptInvite param for existing users
  useEffect(() => {
    if (acceptInviteParam && !acceptAttempted.current) {
      void handleAcceptInvite(acceptInviteParam)
    }
  }, [acceptInviteParam, handleAcceptInvite])

  useEffect(() => {
    // Wait for both contexts to initialize
    if (isProjectLoading || isProjectsLoading) return

    // Don't redirect while accepting an invite
    if (isAccepting) return

    // Case 1: User has a selected project in context - redirect to it
    if (projectId) {
      router.replace(`/projects/${projectId}`)
      return
    }

    // Case 2: No selected project but projects exist - select first and redirect
    if (projects.length > 0) {
      const firstProject = projects[0]
      setProjectId(firstProject.id)
      router.replace(`/projects/${firstProject.id}`)
      return
    }

    // Case 3: No projects at all - redirect to create new
    router.replace('/projects/new')
  }, [projectId, projects, isProjectLoading, isProjectsLoading, setProjectId, router, isAccepting])

  return (
    <div className="flex h-full items-center justify-center">
      <div className="animate-pulse font-mono text-sm text-[color:var(--text-secondary)]">
        Loading...
      </div>
    </div>
  )
}
