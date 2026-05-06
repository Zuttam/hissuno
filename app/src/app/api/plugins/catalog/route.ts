/**
 * GET /api/plugins/catalog
 *
 * Returns plugin metadata the UI needs to render the generic config dialog:
 *   - basic info (id, name, description, category, icon)
 *   - auth schema summary (type + field definitions; no test/connect functions)
 *
 * Server-only plugin implementations (test()/connect() callbacks, etc.) are
 * NOT exposed here. This endpoint is safe to call without authentication.
 *
 * Sync logic lives in automation skills under
 * `src/lib/automations/skills/<plugin>-<stream>/`. The list of available
 * skills tied to a plugin is surfaced separately through the automations API.
 */

import { NextResponse } from 'next/server'
import { listPlugins } from '@/lib/integrations/registry'
import type { AuthFieldDef } from '@/lib/integrations/plugin-kit'

export const runtime = 'nodejs'

export interface CatalogPlugin {
  id: string
  name: string
  description: string
  category: string
  icon: { src: string; darkSrc?: string; inlineSvg?: boolean; invertInDark?: boolean }
  multiInstance: boolean
  comingSoon: boolean
  setupLabel?: string
  auth: {
    type: 'api_key' | 'oauth2' | 'github_app' | 'custom'
    fields?: AuthFieldDef[]
    scopes?: string[]
  }
}

export interface CatalogResponse {
  plugins: CatalogPlugin[]
}

export async function GET() {
  const plugins = listPlugins()

  const payload: CatalogResponse = {
    plugins: plugins.map((p): CatalogPlugin => ({
      id: p.id,
      name: p.name,
      description: p.description,
      category: p.category,
      icon: p.icon,
      multiInstance: p.multiInstance ?? true,
      comingSoon: Boolean(p.comingSoon),
      setupLabel: p.setupLabel,
      auth:
        p.auth.type === 'api_key'
          ? { type: 'api_key', fields: p.auth.fields }
          : p.auth.type === 'oauth2'
            ? { type: 'oauth2', scopes: p.auth.scopes }
            : p.auth.type === 'github_app'
              ? { type: 'github_app' }
              : { type: 'custom' },
    })),
  }

  return NextResponse.json(payload)
}
