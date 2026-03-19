import { randomBytes } from 'crypto';
import { db } from '@/lib/db';
import { isDatabaseConfigured } from '@/lib/db/config';
import { projects, widgetIntegrations } from '@/lib/db/schema/app';
import { eq, and } from 'drizzle-orm';

type ProjectRow = typeof projects.$inferSelect;
type WidgetIntegrationRow = typeof widgetIntegrations.$inferSelect;

// Extended project type with the key fields (flattened from widget_integrations)
export type ProjectWithKeys = ProjectRow & {
  secret_key: string | null;
  allowed_origins: string[] | null;
  widget_token_required: boolean;
};

/**
 * Generates a secure secret key for backend/dashboard use
 * Format: sk_live_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX (sk_live_ + 32 random chars)
 */
export function generateSecretKey(): string {
  const randomPart = randomBytes(24).toString('base64url').slice(0, 32);
  return `sk_live_${randomPart}`;
}

/**
 * Validates that a string looks like a valid secret key
 */
export function validateSecretKey(key: string): boolean {
  if (!key || typeof key !== 'string') return false;
  return /^sk_live_[A-Za-z0-9_-]{32}$/.test(key);
}

/**
 * Flattens project with widget integration into ProjectWithKeys
 */
function flattenProjectWithWidget(
  project: ProjectRow,
  widget: WidgetIntegrationRow | null
): ProjectWithKeys {
  return {
    ...project,
    allowed_origins: widget?.allowed_origins ?? [],
    widget_token_required: widget?.token_required ?? false,
  };
}

/**
 * Looks up a project by its ID
 * Used for widget requests - bypasses RLS for public access
 */
export async function getProjectById(projectId: string): Promise<ProjectWithKeys | null> {
  if (!isDatabaseConfigured()) {
    console.error('[keys] Database must be configured to look up projects by ID');
    return null;
  }

  if (!projectId || typeof projectId !== 'string') {
    console.warn('[keys] Invalid project ID');
    return null;
  }

  try {
    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    if (!project) {
      return null;
    }

    const [widget] = await db
      .select()
      .from(widgetIntegrations)
      .where(eq(widgetIntegrations.project_id, projectId))
      .limit(1);

    return flattenProjectWithWidget(project, widget ?? null);
  } catch (error) {
    console.error('[keys] Unexpected error looking up project:', error);
    return null;
  }
}

/**
 * Looks up a project by its secret key
 * Used for admin operations that require full access
 */
export async function getProjectBySecretKey(secretKey: string): Promise<ProjectWithKeys | null> {
  if (!isDatabaseConfigured()) {
    console.error('[keys] Database must be configured to look up projects by secret key');
    return null;
  }

  if (!validateSecretKey(secretKey)) {
    console.warn('[keys] Invalid secret key format');
    return null;
  }

  try {
    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.secret_key, secretKey))
      .limit(1);

    if (!project) {
      return null;
    }

    const [widget] = await db
      .select()
      .from(widgetIntegrations)
      .where(eq(widgetIntegrations.project_id, project.id))
      .limit(1);

    return flattenProjectWithWidget(project, widget ?? null);
  } catch (error) {
    console.error('[keys] Unexpected error looking up project:', error);
    return null;
  }
}

/**
 * Regenerates a project's secret key
 * This invalidates existing integrations using the old key
 */
export async function regenerateSecretKey(
  projectId: string,
  userId: string
): Promise<string | null> {
  if (!isDatabaseConfigured()) {
    console.error('[keys] Database must be configured to regenerate keys');
    return null;
  }

  const newSecretKey = generateSecretKey();

  try {
    const result = await db
      .update(projects)
      .set({ secret_key: newSecretKey })
      .where(
        and(
          eq(projects.id, projectId),
          eq(projects.user_id, userId)
        )
      )
      .returning({ id: projects.id });

    if (result.length === 0) {
      console.error('[keys] Error regenerating secret key: project not found or access denied');
      return null;
    }

    return newSecretKey;
  } catch (error) {
    console.error('[keys] Unexpected error regenerating key:', error);
    return null;
  }
}

/**
 * Updates a project's allowed origins in widget_integrations
 */
export async function updateAllowedOrigins(
  projectId: string,
  userId: string,
  allowedOrigins: string[]
): Promise<boolean> {
  if (!isDatabaseConfigured()) {
    console.error('[keys] Database must be configured to update allowed origins');
    return false;
  }

  // Normalize and validate origins
  const normalizedOrigins = allowedOrigins
    .map(origin => normalizeOrigin(origin))
    .filter(origin => origin.length > 0);

  try {
    // First verify user owns the project
    const [project] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(
        and(
          eq(projects.id, projectId),
          eq(projects.user_id, userId)
        )
      )
      .limit(1);

    if (!project) {
      console.error('[keys] Project not found or access denied');
      return false;
    }

    // Upsert to widget_integrations
    await db
      .insert(widgetIntegrations)
      .values({ project_id: projectId, allowed_origins: normalizedOrigins })
      .onConflictDoUpdate({
        target: widgetIntegrations.project_id,
        set: { allowed_origins: normalizedOrigins },
      });

    return true;
  } catch (error) {
    console.error('[keys] Unexpected error updating allowed origins:', error);
    return false;
  }
}

/**
 * Normalizes an origin URL for storage
 */
function normalizeOrigin(origin: string): string {
  try {
    const trimmed = origin.trim();
    if (!trimmed) return '';

    // Handle wildcard domains
    if (trimmed.startsWith('*.')) {
      return trimmed.toLowerCase();
    }

    // Add protocol if missing
    let urlString = trimmed;
    if (!urlString.includes('://')) {
      urlString = `https://${urlString}`;
    }

    const url = new URL(urlString);
    return url.origin.toLowerCase();
  } catch {
    return origin.trim().toLowerCase();
  }
}
