/**
 * Graph Evaluation Configuration
 *
 * User-tunable knobs for matching strategies and creation policies.
 * Persisted as jsonb on graph_evaluation_settings.config.
 */

import { z } from 'zod'

const thresholdSchema = z.number().min(0.3).max(0.95)

const semanticStrategySchema = z.object({
  enabled: z.boolean(),
  threshold: thresholdSchema,
})

const companyStrategySchema = z.object({
  semanticEnabled: z.boolean(),
  semanticThreshold: thresholdSchema,
  textMatchEnabled: z.boolean(),
  textMatchMinNameLength: z.number().int().min(1).max(20),
})

const productScopeStrategySchema = z.object({
  enabled: z.boolean(),
  requireFullTopicMatch: z.boolean(),
  llmClassification: z.boolean(),
})

const creationContactsSchema = z.object({
  enabled: z.boolean(),
})

const creationIssuesSchema = z.object({
  enabled: z.boolean(),
  linkThreshold: thresholdSchema,
  safetyNetThreshold: thresholdSchema,
  actionableTags: z.array(z.string()),
})

export const graphEvaluationConfigSchema = z.object({
  strategies: z.object({
    session: semanticStrategySchema,
    issue: semanticStrategySchema,
    knowledge: semanticStrategySchema,
    contact: semanticStrategySchema,
    company: companyStrategySchema,
    productScope: productScopeStrategySchema,
  }),
  creation: z.object({
    contacts: creationContactsSchema,
    issues: creationIssuesSchema,
  }),
})

export type GraphEvaluationConfig = z.infer<typeof graphEvaluationConfigSchema>

export const DEFAULT_GRAPH_EVAL_CONFIG: GraphEvaluationConfig = {
  strategies: {
    session: { enabled: true, threshold: 0.6 },
    issue: { enabled: true, threshold: 0.6 },
    knowledge: { enabled: true, threshold: 0.6 },
    contact: { enabled: true, threshold: 0.6 },
    company: {
      semanticEnabled: true,
      semanticThreshold: 0.6,
      textMatchEnabled: true,
      textMatchMinNameLength: 3,
    },
    productScope: {
      enabled: true,
      requireFullTopicMatch: false,
      llmClassification: true,
    },
  },
  creation: {
    contacts: { enabled: true },
    issues: {
      enabled: true,
      linkThreshold: 0.65,
      safetyNetThreshold: 0.55,
      actionableTags: ['bug', 'feature_request', 'change_request'],
    },
  },
}

/**
 * Parse a stored jsonb config, filling in any missing keys from defaults.
 * Returns the default config if parsing fails entirely.
 */
export function parseGraphEvalConfig(raw: unknown): GraphEvaluationConfig {
  const merged = deepMergeWithDefaults(raw)
  const result = graphEvaluationConfigSchema.safeParse(merged)
  if (!result.success) {
    console.warn('[graph-eval-config] invalid stored config, falling back to defaults:', result.error.message)
    return DEFAULT_GRAPH_EVAL_CONFIG
  }
  return result.data
}

/**
 * Validate and normalize a partial config update, merging on top of the current stored config.
 * Throws on validation failure so callers can return a 400.
 */
export function mergeAndValidateConfig(
  current: GraphEvaluationConfig,
  patch: unknown,
): GraphEvaluationConfig {
  const merged = deepMerge(current, patch)
  return graphEvaluationConfigSchema.parse(merged)
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function deepMerge<T>(base: T, patch: unknown): T {
  if (!isPlainObject(patch) || !isPlainObject(base)) return (patch ?? base) as T
  const out: Record<string, unknown> = { ...base }
  for (const [key, value] of Object.entries(patch)) {
    const baseValue = (base as Record<string, unknown>)[key]
    if (isPlainObject(value) && isPlainObject(baseValue)) {
      out[key] = deepMerge(baseValue, value)
    } else {
      out[key] = value
    }
  }
  return out as T
}

function deepMergeWithDefaults(raw: unknown): GraphEvaluationConfig {
  return deepMerge(DEFAULT_GRAPH_EVAL_CONFIG, raw)
}
