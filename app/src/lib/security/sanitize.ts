/**
 * Security utilities for sanitizing user input before injection into AI prompts.
 *
 * Custom tag descriptions are user-provided content that gets injected into
 * classification agent prompts. This module provides sanitization to prevent
 * prompt injection attacks.
 */

/**
 * Maximum allowed length for tag descriptions
 */
export const MAX_DESCRIPTION_LENGTH = 500

/**
 * Patterns that could indicate prompt injection attempts
 */
const INJECTION_PATTERNS = [
  // Instruction override attempts
  /ignore\s+(previous|all|above|prior|these)\s+instructions?/gi,
  /disregard\s+(previous|all|above|prior|these)\s+instructions?/gi,
  /forget\s+(everything|your|all|the)\s+(instructions?|rules?|training)?/gi,

  // Role/identity manipulation
  /you\s+are\s+now\s+/gi,
  /pretend\s+(to\s+be|you\s+are)/gi,
  /act\s+as\s+(if\s+you\s+are|a)/gi,
  /from\s+now\s+on,?\s+you/gi,

  // System prompt attempts
  /system\s*:\s*/gi,
  /\[system\]/gi,
  /\[INST\]/gi,
  /\[\/INST\]/gi,
  /<<SYS>>/gi,
  /<\|im_start\|>/gi,

  // New instruction injection
  /new\s+instructions?:\s*/gi,
  /updated?\s+instructions?:\s*/gi,
  /override\s+instructions?:\s*/gi,
  /replace\s+instructions?:\s*/gi,

  // Output manipulation
  /output\s*:\s*/gi,
  /response\s*:\s*/gi,
  /answer\s*:\s*/gi,

  // Jailbreak attempts
  /dan\s+mode/gi,
  /developer\s+mode/gi,
  /evil\s+mode/gi,
  /jailbreak/gi,
  /bypass\s+(your|the|all)\s+(restrictions?|rules?|filters?)/gi,

  // Confidential information extraction
  /reveal\s+(your|the)\s+(system|instructions?|prompt)/gi,
  /show\s+(me\s+)?(your|the)\s+(system|instructions?|prompt)/gi,
  /what\s+(are|is)\s+your\s+(system|instructions?|prompt)/gi,
]

/**
 * Sanitizes a tag description for safe injection into AI prompts.
 *
 * This function:
 * 1. Removes control characters
 * 2. Strips code blocks that could escape context
 * 3. Removes XML/HTML-like tags
 * 4. Filters known prompt injection patterns
 * 5. Enforces length limits
 *
 * @param description - The user-provided description
 * @returns Sanitized description safe for prompt injection
 */
export function sanitizeTagDescription(description: string): string {
  if (!description || typeof description !== 'string') {
    return ''
  }

  let sanitized = description

  // Remove control characters (except newlines and tabs)
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')

  // Strip markdown code blocks that could escape context
  sanitized = sanitized.replace(/```[\s\S]*?```/g, '[code removed]')

  // Strip inline code that might contain special sequences
  sanitized = sanitized.replace(/`[^`]+`/g, '[code]')

  // Remove XML/HTML-like tags that could confuse prompt structure
  sanitized = sanitized.replace(/<[^>]+>/g, '')

  // Remove any unicode direction control characters
  sanitized = sanitized.replace(/[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, '')

  // Filter known injection patterns
  for (const pattern of INJECTION_PATTERNS) {
    sanitized = sanitized.replace(pattern, '[filtered]')
  }

  // Collapse multiple whitespace characters
  sanitized = sanitized.replace(/\s+/g, ' ')

  // Enforce length limit
  if (sanitized.length > MAX_DESCRIPTION_LENGTH) {
    sanitized = sanitized.substring(0, MAX_DESCRIPTION_LENGTH)
  }

  return sanitized.trim()
}

/**
 * Validates a tag slug format.
 * Slugs must be lowercase, start with a letter, and contain only letters, numbers, and underscores.
 *
 * @param slug - The slug to validate
 * @returns True if valid, false otherwise
 */
export function isValidSlug(slug: string): boolean {
  if (!slug || typeof slug !== 'string') {
    return false
  }
  return /^[a-z][a-z0-9_]*$/.test(slug)
}

/**
 * Generates a slug from a display name.
 * Converts to lowercase, replaces spaces/special chars with underscores.
 *
 * @param name - The display name
 * @returns A valid slug
 */
export function generateSlugFromName(name: string): string {
  if (!name || typeof name !== 'string') {
    return ''
  }

  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_') // Replace non-alphanumeric with underscores
    .replace(/^_+|_+$/g, '')      // Trim leading/trailing underscores
    .replace(/_+/g, '_')          // Collapse multiple underscores
    .substring(0, 30)             // Limit length
    || 'label'                    // Fallback if empty
}

/**
 * Validates a tag name.
 * Names must be 1-50 characters, printable ASCII + common Unicode.
 *
 * @param name - The name to validate
 * @returns True if valid, false otherwise
 */
export function isValidTagName(name: string): boolean {
  if (!name || typeof name !== 'string') {
    return false
  }
  const trimmed = name.trim()
  return trimmed.length >= 1 && trimmed.length <= 50
}

/**
 * Checks if a description might contain harmful content.
 * Returns the first matching pattern name for logging purposes.
 *
 * @param description - The description to check
 * @returns Null if safe, pattern description if potentially harmful
 */
export function detectInjectionAttempt(description: string): string | null {
  if (!description || typeof description !== 'string') {
    return null
  }

  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(description)) {
      // Reset regex lastIndex since we're using global flag
      pattern.lastIndex = 0
      return pattern.source.substring(0, 30) + '...'
    }
  }

  return null
}
