import type { RequestIdentity } from './identity'
import type { ProjectRole } from '@/types/project-members'
import { hasProjectAccess, hasProjectRole } from './project-members'
import { UnauthorizedError } from './server'

export class ForbiddenError extends Error {
  status = 403

  constructor(message = 'Forbidden') {
    super(message)
    this.name = 'ForbiddenError'
  }
}

/**
 * Assert that the given identity has access to a project.
 * For 'user' type: checks project_members table.
 * For 'api_key' type: validates key's projectId matches (defense-in-depth — proxy already verified).
 *
 * @param options.requiredRole - If set, requires a specific role (e.g., 'owner')
 */
export async function assertProjectAccess(
  identity: RequestIdentity,
  projectId: string,
  options?: { requiredRole?: ProjectRole }
): Promise<void> {
  if (identity.type === 'api_key') {
    // API key is already scoped to a project by the proxy.
    // Defense-in-depth: verify the project ID matches.
    if (identity.projectId !== projectId) {
      throw new ForbiddenError('API key is not scoped to this project.')
    }
    // API keys don't have role granularity — they act as the creator.
    // If a specific role is required, check the creator's role.
    if (options?.requiredRole) {
      const hasRole = await hasProjectRole(projectId, identity.createdByUserId, options.requiredRole)
      if (!hasRole) {
        throw new ForbiddenError(`Requires '${options.requiredRole}' role.`)
      }
    }
    return
  }

  // User identity — check membership
  if (options?.requiredRole) {
    const hasRole = await hasProjectRole(projectId, identity.userId, options.requiredRole)
    if (!hasRole) {
      throw new ForbiddenError(`Requires '${options.requiredRole}' role.`)
    }
  } else {
    const hasAccess = await hasProjectAccess(projectId, identity.userId)
    if (!hasAccess) {
      throw new UnauthorizedError()
    }
  }
}
