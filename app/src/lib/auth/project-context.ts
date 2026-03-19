import { NextRequest } from 'next/server'

export class MissingProjectIdError extends Error {
  status = 400
  constructor() {
    super('projectId query parameter is required.')
    this.name = 'MissingProjectIdError'
  }
}

export function requireProjectId(request: NextRequest): string {
  const projectId = request.nextUrl.searchParams.get('projectId')
  if (!projectId) throw new MissingProjectIdError()
  return projectId
}
