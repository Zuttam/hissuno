import type { UTMParams } from './types'

const UTM_STORAGE_KEY = 'hissuno_utm'
const PRESELECTED_USECASE_KEY = 'hissuno_preselected_usecase'
const UTM_PARAM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'] as const

/**
 * Parse UTM parameters from URLSearchParams
 */
export function parseUTMFromURL(searchParams: URLSearchParams): UTMParams {
  const params: UTMParams = {}
  for (const key of UTM_PARAM_KEYS) {
    const value = searchParams.get(key)
    if (value) {
      params[key] = value
    }
  }
  return params
}

/**
 * Parse UTM parameters from a plain object (e.g., Next.js searchParams)
 */
export function parseUTMFromObject(obj: Record<string, string | string[] | undefined>): UTMParams {
  const params: UTMParams = {}
  for (const key of UTM_PARAM_KEYS) {
    const value = obj[key]
    if (typeof value === 'string') {
      params[key] = value
    } else if (Array.isArray(value) && value[0]) {
      params[key] = value[0]
    }
  }
  return params
}

/**
 * Store UTM parameters in sessionStorage
 */
export function storeUTM(params: UTMParams): void {
  if (typeof window === 'undefined') return
  if (Object.keys(params).length > 0) {
    sessionStorage.setItem(UTM_STORAGE_KEY, JSON.stringify(params))
  }
}

/**
 * Get stored UTM parameters from sessionStorage
 */
export function getStoredUTM(): UTMParams | null {
  if (typeof window === 'undefined') return null
  const stored = sessionStorage.getItem(UTM_STORAGE_KEY)
  return stored ? JSON.parse(stored) : null
}

/**
 * Clear stored UTM parameters
 */
export function clearStoredUTM(): void {
  if (typeof window === 'undefined') return
  sessionStorage.removeItem(UTM_STORAGE_KEY)
}

/**
 * Store pre-selected use case for onboarding
 */
export function storePreselectedUseCase(useCase: string): void {
  if (typeof window === 'undefined') return
  sessionStorage.setItem(PRESELECTED_USECASE_KEY, useCase)
}

/**
 * Get pre-selected use case for onboarding
 */
export function getPreselectedUseCase(): string | null {
  if (typeof window === 'undefined') return null
  return sessionStorage.getItem(PRESELECTED_USECASE_KEY)
}

/**
 * Clear pre-selected use case
 */
export function clearPreselectedUseCase(): void {
  if (typeof window === 'undefined') return
  sessionStorage.removeItem(PRESELECTED_USECASE_KEY)
}

/**
 * Map utm_content value to a use case ID for pre-selection
 */
export function utmContentToUseCase(utmContent: string | undefined): string | null {
  if (!utmContent) return null

  const mapping: Record<string, string> = {
    // Knowledge / Support Agent
    knowledge: 'knowledge',
    'support-agent': 'knowledge',
    // Slack / Customer Success
    slack: 'slack',
    'customer-success': 'slack',
    // Triage
    triage: 'triage',
    'automated-triage': 'triage',
    // Specs
    specs: 'specs',
    'product-specs': 'specs',
  }

  return mapping[utmContent.toLowerCase()] ?? null
}

/**
 * Build UTM query string from params
 */
export function buildUTMQueryString(params: UTMParams): string {
  const entries = Object.entries(params).filter(([, value]) => value)
  if (entries.length === 0) return ''
  return entries.map(([key, value]) => `${key}=${encodeURIComponent(value!)}`).join('&')
}
