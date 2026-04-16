import { NextRequest, NextResponse } from 'next/server'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { UnauthorizedError } from '@/lib/auth/server'
import { isDatabaseConfigured } from '@/lib/db/config'
import {
  getAIModelSettings,
  updateAIModelSettings,
} from '@/lib/db/queries/project-settings/ai-model'
import { requireProjectId, MissingProjectIdError } from '@/lib/auth/project-context'
import { resolveModelByTier, getAvailableProviders, PROVIDER_DEFAULTS, PROVIDERS } from '@/mastra/models'

export const runtime = 'nodejs'

/**
 * GET /api/settings/ai-model?projectId=...
 * Returns current AI model settings, resolved values, and available providers.
 */
export async function GET(request: NextRequest) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  try {
    const projectId = requireProjectId(request)
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)

    const settings = await getAIModelSettings(projectId)

    // Resolve what's actually in use after the full cascade
    const resolvedDefault = resolveModelByTier('default', settings)
    const resolvedSmall = resolveModelByTier('small', settings)

    return NextResponse.json({
      settings,
      resolved: { default: resolvedDefault, small: resolvedSmall },
      availableProviders: getAvailableProviders(),
      providerDefaults: PROVIDER_DEFAULTS,
      providers: PROVIDERS,
    })
  } catch (error) {
    if (error instanceof MissingProjectIdError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    }

    console.error('[settings.ai-model.get] unexpected error', error)
    return NextResponse.json({ error: 'Failed to load settings.' }, { status: 500 })
  }
}

/**
 * PATCH /api/settings/ai-model?projectId=...
 * Update AI model settings for a project.
 */
export async function PATCH(request: NextRequest) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  try {
    const projectId = requireProjectId(request)
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)

    const body = await request.json()
    const { ai_model, ai_model_small } = body as {
      ai_model?: string | null
      ai_model_small?: string | null
    }

    // Validate model strings if provided
    if (ai_model && !ai_model.includes('/')) {
      return NextResponse.json(
        { error: 'Model must be in provider/model format (e.g. openai/gpt-5).' },
        { status: 400 },
      )
    }
    if (ai_model_small && !ai_model_small.includes('/')) {
      return NextResponse.json(
        { error: 'Model must be in provider/model format (e.g. openai/gpt-5.4-mini).' },
        { status: 400 },
      )
    }

    const settings = await updateAIModelSettings(projectId, { ai_model, ai_model_small })

    // Return resolved values too
    const resolvedDefault = resolveModelByTier('default', settings)
    const resolvedSmall = resolveModelByTier('small', settings)

    return NextResponse.json({
      settings,
      resolved: { default: resolvedDefault, small: resolvedSmall },
    })
  } catch (error) {
    if (error instanceof MissingProjectIdError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    }

    console.error('[settings.ai-model.patch] unexpected error', error)
    return NextResponse.json({ error: 'Failed to update settings.' }, { status: 500 })
  }
}
