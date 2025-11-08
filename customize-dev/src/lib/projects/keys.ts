import { randomBytes } from 'crypto';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server';
import type { Database } from '@/types/supabase';

type ProjectRecord = Database['public']['Tables']['projects']['Row'];

// Extended project type with the new key fields
export type ProjectWithKeys = ProjectRecord & {
  public_key: string | null;
  secret_key: string | null;
  allowed_origins: string[] | null;
};

/**
 * Generates a secure public key for frontend widget use
 * Format: pk_live_XXXXXXXXXXXXXXXXXXXXXXXX (pk_live_ + 24 random chars)
 */
export function generatePublicKey(): string {
  const randomPart = randomBytes(18).toString('base64url').slice(0, 24);
  return `pk_live_${randomPart}`;
}

/**
 * Generates a secure secret key for backend/dashboard use
 * Format: sk_live_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX (sk_live_ + 32 random chars)
 */
export function generateSecretKey(): string {
  const randomPart = randomBytes(24).toString('base64url').slice(0, 32);
  return `sk_live_${randomPart}`;
}

/**
 * Validates that a string looks like a valid public key
 */
export function validatePublicKey(key: string): boolean {
  if (!key || typeof key !== 'string') return false;
  return /^pk_live_[A-Za-z0-9_-]{24}$/.test(key);
}

/**
 * Validates that a string looks like a valid secret key
 */
export function validateSecretKey(key: string): boolean {
  if (!key || typeof key !== 'string') return false;
  return /^sk_live_[A-Za-z0-9_-]{32}$/.test(key);
}

/**
 * Looks up a project by its public key
 * Used by the CopilotKit endpoint to validate widget requests
 */
export async function getProjectByPublicKey(publicKey: string): Promise<ProjectWithKeys | null> {
  if (!isSupabaseConfigured()) {
    console.error('[keys] Supabase must be configured to look up projects');
    return null;
  }

  if (!validatePublicKey(publicKey)) {
    console.warn('[keys] Invalid public key format');
    return null;
  }

  try {
    const supabase = await createClient();
    
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('public_key', publicKey)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // Not found
        return null;
      }
      console.error('[keys] Error looking up project by public key:', error);
      return null;
    }

    return data as ProjectWithKeys;
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
  if (!isSupabaseConfigured()) {
    console.error('[keys] Supabase must be configured to look up projects');
    return null;
  }

  if (!validateSecretKey(secretKey)) {
    console.warn('[keys] Invalid secret key format');
    return null;
  }

  try {
    const supabase = await createClient();
    
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('secret_key', secretKey)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      console.error('[keys] Error looking up project by secret key:', error);
      return null;
    }

    return data as ProjectWithKeys;
  } catch (error) {
    console.error('[keys] Unexpected error looking up project:', error);
    return null;
  }
}

/**
 * Generates both public and secret keys for a project
 * Returns an object that can be used to update the project
 */
export function generateProjectKeys(): { public_key: string; secret_key: string } {
  return {
    public_key: generatePublicKey(),
    secret_key: generateSecretKey(),
  };
}

/**
 * Updates a project's keys (regeneration)
 * This invalidates all existing widget integrations using the old keys
 */
export async function regenerateProjectKeys(
  projectId: string,
  userId: string
): Promise<{ public_key: string; secret_key: string } | null> {
  if (!isSupabaseConfigured()) {
    console.error('[keys] Supabase must be configured to regenerate keys');
    return null;
  }

  const newKeys = generateProjectKeys();

  try {
    const supabase = await createClient();
    
    const { error } = await supabase
      .from('projects')
      .update(newKeys)
      .eq('id', projectId)
      .eq('user_id', userId);

    if (error) {
      console.error('[keys] Error regenerating project keys:', error);
      return null;
    }

    return newKeys;
  } catch (error) {
    console.error('[keys] Unexpected error regenerating keys:', error);
    return null;
  }
}

/**
 * Updates a project's allowed origins
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
    
    const { error } = await supabase
      .from('projects')
      .update({ allowed_origins: normalizedOrigins })
      .eq('id', projectId)
      .eq('user_id', userId);

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

