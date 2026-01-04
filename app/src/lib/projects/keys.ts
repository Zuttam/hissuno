import { randomBytes } from 'crypto';
import { createClient, createAdminClient, isSupabaseConfigured, isServiceRoleConfigured } from '@/lib/supabase/server';
import type { Database } from '@/types/supabase';

type ProjectRecord = Database['public']['Tables']['projects']['Row'];
type ProjectSettingsRecord = Database['public']['Tables']['project_settings']['Row'];

// Extended project type with the key fields (flattened from project_settings)
export type ProjectWithKeys = ProjectRecord & {
  secret_key: string | null;
  allowed_origins: string[] | null;
  widget_token_required: boolean;
};

// Raw type from database join
type ProjectWithSettingsJoin = ProjectRecord & {
  project_settings: ProjectSettingsRecord | null;
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
 * Flattens project with settings join into ProjectWithKeys
 */
function flattenProjectWithSettings(data: ProjectWithSettingsJoin): ProjectWithKeys {
  const { project_settings, ...project } = data;
  return {
    ...project,
    allowed_origins: project_settings?.allowed_origins ?? [],
    widget_token_required: project_settings?.widget_token_required ?? false,
  };
}

/**
 * Looks up a project by its ID
 * Used for widget requests - bypasses RLS for public access
 */
export async function getProjectById(projectId: string): Promise<ProjectWithKeys | null> {
  if (!isServiceRoleConfigured()) {
    console.error('[keys] Service role must be configured to look up projects by ID');
    return null;
  }

  if (!projectId || typeof projectId !== 'string') {
    console.warn('[keys] Invalid project ID');
    return null;
  }

  try {
    // Use admin client to bypass RLS for public widget requests
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from('projects')
      .select('*, project_settings(*)')
      .eq('id', projectId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // Not found
        return null;
      }
      console.error('[keys] Error looking up project by ID:', error);
      return null;
    }

    return flattenProjectWithSettings(data as ProjectWithSettingsJoin);
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
  if (!isServiceRoleConfigured()) {
    console.error('[keys] Service role must be configured to look up projects by secret key');
    return null;
  }

  if (!validateSecretKey(secretKey)) {
    console.warn('[keys] Invalid secret key format');
    return null;
  }

  try {
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from('projects')
      .select('*, project_settings(*)')
      .eq('secret_key', secretKey)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      console.error('[keys] Error looking up project by secret key:', error);
      return null;
    }

    return flattenProjectWithSettings(data as ProjectWithSettingsJoin);
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
  if (!isSupabaseConfigured()) {
    console.error('[keys] Supabase must be configured to regenerate keys');
    return null;
  }

  const newSecretKey = generateSecretKey();

  try {
    const supabase = await createClient();

    const { error } = await supabase
      .from('projects')
      .update({ secret_key: newSecretKey })
      .eq('id', projectId)
      .eq('user_id', userId);

    if (error) {
      console.error('[keys] Error regenerating secret key:', error);
      return null;
    }

    return newSecretKey;
  } catch (error) {
    console.error('[keys] Unexpected error regenerating key:', error);
    return null;
  }
}

/**
 * Updates a project's allowed origins in project_settings
 */
export async function updateAllowedOrigins(
  projectId: string,
  userId: string,
  allowedOrigins: string[]
): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    console.error('[keys] Supabase must be configured to update allowed origins');
    return false;
  }

  // Normalize and validate origins
  const normalizedOrigins = allowedOrigins
    .map(origin => normalizeOrigin(origin))
    .filter(origin => origin.length > 0);

  try {
    const supabase = await createClient();

    // First verify user owns the project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .eq('user_id', userId)
      .single();

    if (projectError || !project) {
      console.error('[keys] Project not found or access denied:', projectError);
      return false;
    }

    // Upsert to project_settings
    const { error } = await supabase
      .from('project_settings')
      .upsert(
        { project_id: projectId, allowed_origins: normalizedOrigins },
        { onConflict: 'project_id' }
      );

    if (error) {
      console.error('[keys] Error updating allowed origins:', error);
      return false;
    }

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
