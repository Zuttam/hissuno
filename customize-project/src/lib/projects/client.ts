export async function createProject(formData: FormData) {
  const response = await fetch('/api/projects', {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    const errorMessage = typeof payload?.error === 'string' ? payload.error : 'Failed to create project.'
    throw new Error(errorMessage)
  }

  return response.json()
}

export async function updateProject(projectId: string, payload: Record<string, unknown>) {
  const response = await fetch(`/api/projects/${projectId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const data = await response.json().catch(() => null)
    const errorMessage = typeof data?.error === 'string' ? data.error : 'Failed to update project.'
    throw new Error(errorMessage)
  }

  return response.json()
}

export async function deleteProject(projectId: string) {
  const response = await fetch(`/api/projects/${projectId}`, {
    method: 'DELETE',
  })

  if (!response.ok) {
    const data = await response.json().catch(() => null)
    const errorMessage = typeof data?.error === 'string' ? data.error : 'Failed to delete project.'
    throw new Error(errorMessage)
  }

  return response.json()
}

export async function triggerAnalysis(projectId: string, formData: FormData) {
  const response = await fetch(`/api/projects/${projectId}/analyses`, {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    const errorMessage = typeof payload?.error === 'string' ? payload.error : 'Failed to run analysis.'
    throw new Error(errorMessage)
  }

  return response.json()
}

