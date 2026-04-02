/**
 * CLI Configuration — ~/.hissuno/config.json management
 *
 * Supports both legacy flat configs and multi-profile configs.
 * loadConfig() and saveConfig() are backward-compatible — callers don't need to change.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

export interface HissunoConfig {
  api_key?: string
  auth_token?: string
  base_url: string
  project_id?: string
  username?: string
}

export type ProfileConfig = HissunoConfig

export interface MultiProfileConfig {
  active_profile: string
  profiles: Record<string, ProfileConfig>
}

interface LegacyConfig {
  api_key?: string
  auth_token?: string
  endpoint?: string
  base_url?: string
  project_id?: string
  username?: string
}

type RawConfig = LegacyConfig | MultiProfileConfig

const PROFILE_NAME_RE = /^[a-z0-9-]+$/

export const CONFIG_DIR = join(homedir(), '.hissuno')
const CONFIG_PATH = join(CONFIG_DIR, 'config.json')

function isMultiProfileConfig(raw: RawConfig): raw is MultiProfileConfig {
  return 'profiles' in raw && typeof (raw as MultiProfileConfig).profiles === 'object'
}

function parseLegacyProfile(parsed: LegacyConfig): HissunoConfig | null {
  if (!parsed.api_key && !parsed.auth_token) return null

  let baseUrl = parsed.base_url
  if (!baseUrl && parsed.endpoint) {
    baseUrl = new URL(parsed.endpoint).origin
  }
  if (!baseUrl) return null

  return {
    ...(parsed.api_key ? { api_key: parsed.api_key } : {}),
    ...(parsed.auth_token ? { auth_token: parsed.auth_token } : {}),
    base_url: baseUrl,
    ...(parsed.project_id ? { project_id: parsed.project_id } : {}),
    ...(parsed.username ? { username: parsed.username } : {}),
  }
}

function readRawConfig(): RawConfig | null {
  if (!existsSync(CONFIG_PATH)) return null
  try {
    return JSON.parse(readFileSync(CONFIG_PATH, 'utf-8')) as RawConfig
  } catch {
    return null
  }
}

function writeRawConfig(raw: RawConfig): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true })
  }
  writeFileSync(CONFIG_PATH, JSON.stringify(raw, null, 2) + '\n', 'utf-8')
}

// ---------------------------------------------------------------------------
// Public API — backward-compatible
// ---------------------------------------------------------------------------

/**
 * Load the active profile's config. Handles both legacy and multi-profile formats.
 */
export function loadConfig(): HissunoConfig | null {
  const raw = readRawConfig()
  if (!raw) return null

  try {
    if (isMultiProfileConfig(raw)) {
      const profile = raw.profiles[raw.active_profile]
      if (!profile) return null
      return { ...profile }
    }
    return parseLegacyProfile(raw as LegacyConfig)
  } catch {
    return null
  }
}

/**
 * Save config to the active profile slot (multi-profile) or as flat config (legacy).
 */
export function saveConfig(config: HissunoConfig): void {
  const raw = readRawConfig()

  if (raw && isMultiProfileConfig(raw)) {
    raw.profiles[raw.active_profile] = {
      ...(config.api_key ? { api_key: config.api_key } : {}),
      ...(config.auth_token ? { auth_token: config.auth_token } : {}),
      base_url: config.base_url,
      ...(config.project_id ? { project_id: config.project_id } : {}),
      ...(config.username ? { username: config.username } : {}),
    }
    writeRawConfig(raw)
  } else {
    writeRawConfig(config)
  }
}

export function requireConfig(): HissunoConfig {
  const config = loadConfig()
  if (!config || (!config.api_key && !config.auth_token)) {
    console.error('Not configured. Run `hissuno login` or `hissuno config` to set up.')
    process.exit(1)
  }
  return config
}

// ---------------------------------------------------------------------------
// Multi-profile helpers
// ---------------------------------------------------------------------------

/**
 * Load the full raw config (for profile management commands).
 */
export function loadFullConfig(): MultiProfileConfig | null {
  const raw = readRawConfig()
  if (!raw) return null

  if (isMultiProfileConfig(raw)) return raw

  // Legacy format — wrap it
  const legacy = parseLegacyProfile(raw as LegacyConfig)
  if (!legacy) return null

  return {
    active_profile: 'default',
    profiles: { default: legacy },
  }
}

export function getActiveProfileName(): string {
  const raw = readRawConfig()
  if (raw && isMultiProfileConfig(raw)) return raw.active_profile
  return 'default'
}

export function listProfiles(): string[] {
  const full = loadFullConfig()
  if (!full) return []
  return Object.keys(full.profiles)
}

export function setActiveProfile(name: string): void {
  const full = loadFullConfig()
  if (!full) throw new Error('No configuration found. Run `hissuno config` first.')
  if (!full.profiles[name]) throw new Error(`Profile "${name}" does not exist.`)
  full.active_profile = name
  writeRawConfig(full)
}

export function createProfile(name: string, config: ProfileConfig): void {
  validateProfileName(name)

  let full = loadFullConfig()
  if (!full) {
    full = { active_profile: name, profiles: {} }
  }
  if (full.profiles[name]) throw new Error(`Profile "${name}" already exists.`)
  full.profiles[name] = config
  writeRawConfig(full)
}

export function deleteProfile(name: string): void {
  const full = loadFullConfig()
  if (!full) throw new Error('No configuration found.')
  if (!full.profiles[name]) throw new Error(`Profile "${name}" does not exist.`)
  if (full.active_profile === name) throw new Error(`Cannot delete the active profile "${name}". Switch to another profile first.`)
  delete full.profiles[name]
  writeRawConfig(full)
}

/**
 * Migrate a legacy flat config to multi-profile format.
 * No-op if already multi-profile.
 */
export function migrateToMultiProfile(): MultiProfileConfig {
  const raw = readRawConfig()

  if (raw && isMultiProfileConfig(raw)) return raw

  const legacy = raw ? parseLegacyProfile(raw as LegacyConfig) : null
  const full: MultiProfileConfig = {
    active_profile: 'default',
    profiles: legacy ? { default: legacy } : {},
  }
  writeRawConfig(full)
  return full
}

export function validateProfileName(name: string): void {
  if (!name) throw new Error('Profile name is required.')
  if (name.length > 30) throw new Error('Profile name must be 30 characters or fewer.')
  if (!PROFILE_NAME_RE.test(name)) throw new Error('Profile name must contain only lowercase letters, numbers, and hyphens.')
}
