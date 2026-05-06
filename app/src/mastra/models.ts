/**
 * Central AI model configuration.
 *
 * Each call site (agent or inline AI call) declares its own ModelConfig
 * with a unique name, tier, and fallback. This file only owns the tier
 * config and the resolution logic.
 *
 * Resolution order (first non-null wins):
 *   1. Per-project DB settings (passed via AIModelSettings or runtimeContext)
 *   2. Per-agent env var  AI_MODEL_<NAME_UPPER_SNAKE>
 *   3. Tier env var       AI_MODEL / AI_MODEL_SMALL
 *   4. Hardcoded fallback from the caller's ModelConfig
 */

import type { RequestContext } from '@mastra/core/request-context'
import type { AIModelSettings } from '@/lib/db/queries/project-settings/types'

export type { AIModelSettings }
export type ModelTier = 'default' | 'small'

/**
 * Per-agent model configuration. Each call site owns its own config
 * and passes it to resolveModel().
 */
export interface ModelConfig {
  /** Unique identifier used for per-agent env var override (AI_MODEL_<NAME>). Kebab-case. */
  name: string
  /** Which tier this agent uses; controls which DB column and tier env var apply. */
  tier: ModelTier
  /** Hardcoded fallback model string when no project/env setting is present. */
  fallback: string
}

// ---------------------------------------------------------------------------
// Tier config
// ---------------------------------------------------------------------------

const TIERS: Record<ModelTier, { env: string; fallback: string }> = {
  default: { env: 'AI_MODEL', fallback: 'openai/gpt-5' },
  small: { env: 'AI_MODEL_SMALL', fallback: 'openai/gpt-5.4-mini' },
}

export const PROVIDERS: Record<string, {
  label: string
  icon: string
  defaults: { default: string; small: string }
  models: { default: string[]; small: string[] }
}> = {
  openai: {
    label: 'OpenAI',
    icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%23888' d='M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z'/%3E%3C/svg%3E",
    defaults: { default: 'gpt-5', small: 'gpt-5.4-mini' },
    models: {
      default: ['gpt-5.4', 'gpt-5.4-pro', 'gpt-5.2', 'gpt-5.2-pro', 'gpt-5.1', 'gpt-5', 'gpt-4.1', 'o3', 'o1'],
      small: ['gpt-5.4-mini', 'gpt-5.4-nano', 'gpt-5-mini', 'gpt-5-nano', 'gpt-4.1-mini', 'gpt-4.1-nano', 'o3-mini'],
    },
  },
  anthropic: {
    label: 'Anthropic',
    icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%23888' d='M13.827 3.52h3.603L24 20.48h-3.603l-6.57-16.96zm-7.258 0h3.767L16.906 20.48h-3.674l-1.343-3.461H5.017l-1.344 3.46H0l6.57-16.96zm1.96 5.252l-2.571 6.63h5.136l-2.564-6.63z'/%3E%3C/svg%3E",
    defaults: { default: 'claude-sonnet-4-6', small: 'claude-haiku-4-5' },
    models: {
      default: ['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-opus-4-5', 'claude-sonnet-4-5', 'claude-opus-4-1', 'claude-sonnet-4-0'],
      small: ['claude-haiku-4-5'],
    },
  },
  google: {
    label: 'Google',
    icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%234285F4' d='M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z'/%3E%3Cpath fill='%2334A853' d='M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z'/%3E%3Cpath fill='%23FBBC05' d='M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z'/%3E%3Cpath fill='%23EA4335' d='M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z'/%3E%3C/svg%3E",
    defaults: { default: 'gemini-2.5-pro', small: 'gemini-2.5-flash' },
    models: {
      default: ['gemini-3.1-pro-preview', 'gemini-2.5-pro'],
      small: ['gemini-3-flash-preview', 'gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-3.1-flash-lite-preview'],
    },
  },
}

export const PROVIDER_DEFAULTS: Record<string, { default: string; small: string }> = Object.fromEntries(
  Object.entries(PROVIDERS).map(([k, v]) => [k, {
    default: `${k}/${v.defaults.default}`,
    small: `${k}/${v.defaults.small}`,
  }]),
)

const AI_SETTINGS_CTX_KEY = 'aiModelSettings'

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Resolve the model string for an agent given its ModelConfig.
 * Accepts a RuntimeContext (for Mastra agents) or plain AIModelSettings
 * (for inline calls from the service layer).
 */
export function resolveModel(
  config: ModelConfig,
  input?: RequestContext | AIModelSettings | null,
): string {
  const settings = extractSettings(input)

  // 1. Per-project DB
  const fromProject = settings?.[config.tier === 'default' ? 'ai_model' : 'ai_model_small']
  if (fromProject) return fromProject

  // 2. Per-agent env var
  const perAgent = process.env[`AI_MODEL_${config.name.toUpperCase().replace(/-/g, '_')}`]
  if (perAgent) return perAgent

  // 3. Tier env var
  const fromTierEnv = process.env[TIERS[config.tier].env]
  if (fromTierEnv) return fromTierEnv

  // 4. Hardcoded fallback
  return config.fallback
}

/** Resolve model string by tier. Used by the API route. */
export function resolveModelByTier(
  tier: ModelTier,
  settings?: AIModelSettings | null,
): string {
  const fromProject = settings?.[tier === 'default' ? 'ai_model' : 'ai_model_small']
  if (fromProject) return fromProject

  const fromEnv = process.env[TIERS[tier].env]
  if (fromEnv) return fromEnv

  return TIERS[tier].fallback
}

/**
 * For LLM calls, use a Mastra `Agent` instantiated with `resolveModel()`:
 *
 *   const MY_MODEL = { name: 'my-agent', tier: 'small', fallback: 'openai/gpt-5.4-mini' }
 *   const agent = new Agent({ name, instructions, model: resolveModel(MY_MODEL) })
 *   const { object } = await agent.generate(prompt, { output: zodSchema })  // structured
 *   const { text } = await agent.generate(prompt)                           // plain text
 *
 * Do NOT use the Vercel AI SDK's `generateObject`/`generateText`/`streamObject`
 * directly with a Mastra-routed model - those calls either throw
 * "doGenerate is not supported" or hang indefinitely. Agents are the only
 * supported path for LLM calls in this codebase.
 */

/** List providers with API keys configured on this server. */
export function getAvailableProviders(): string[] {
  const keys: Record<string, string> = {
    openai: 'OPENAI_API_KEY',
    anthropic: 'ANTHROPIC_API_KEY',
    google: 'GOOGLE_GENERATIVE_AI_API_KEY',
  }
  return Object.entries(keys).filter(([, env]) => process.env[env]).map(([p]) => p)
}

// ---------------------------------------------------------------------------

function extractSettings(input?: RequestContext | AIModelSettings | null): AIModelSettings | null {
  if (!input) return null
  if (typeof (input as RequestContext).get === 'function') {
    return ((input as RequestContext).get(AI_SETTINGS_CTX_KEY) as AIModelSettings) ?? null;
  }
  return input as AIModelSettings
}
