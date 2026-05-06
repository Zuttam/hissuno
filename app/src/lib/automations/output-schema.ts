/**
 * Convert a SKILL.md frontmatter `output` schema (a narrow JSON-Schema subset)
 * into a Zod schema for Mastra's `structuredOutput`, plus a flattener used by
 * the UI to render the expected fields.
 *
 * Keep the converter strict — anything we don't explicitly support throws so
 * skill authors notice typos at dispatch time instead of getting silently
 * wrong behavior.
 */

import { z } from 'zod'
import type { JsonSchemaNode } from './types'

export class InvalidOutputSchemaError extends Error {
  constructor(message: string, readonly path: string) {
    super(`Invalid output schema at ${path || '<root>'}: ${message}`)
    this.name = 'InvalidOutputSchemaError'
  }
}

export function jsonSchemaToZod(node: JsonSchemaNode, path = ''): z.ZodTypeAny {
  if (!node || typeof node !== 'object' || typeof node.type !== 'string') {
    throw new InvalidOutputSchemaError('expected an object with a string `type`', path)
  }

  switch (node.type) {
    case 'object': {
      if (!node.properties || typeof node.properties !== 'object') {
        throw new InvalidOutputSchemaError('object node must declare `properties`', path)
      }
      const required = new Set(node.required ?? [])
      const shape: Record<string, z.ZodTypeAny> = {}
      for (const [key, child] of Object.entries(node.properties)) {
        const childPath = path ? `${path}.${key}` : key
        const childZod = jsonSchemaToZod(child, childPath)
        shape[key] = required.has(key) ? childZod : childZod.optional()
      }
      const obj = z.object(shape)
      return node.description ? obj.describe(node.description) : obj
    }
    case 'array': {
      if (!node.items) {
        throw new InvalidOutputSchemaError('array node must declare `items`', path)
      }
      const childPath = path ? `${path}[]` : '[]'
      const arr = z.array(jsonSchemaToZod(node.items, childPath))
      return node.description ? arr.describe(node.description) : arr
    }
    case 'string': {
      let base: z.ZodTypeAny = z.string()
      if (node.enum && node.enum.length > 0) {
        if (!node.enum.every((v): v is string => typeof v === 'string')) {
          throw new InvalidOutputSchemaError('string enum values must all be strings', path)
        }
        base = z.enum(node.enum as [string, ...string[]])
      }
      return node.description ? base.describe(node.description) : base
    }
    case 'number':
    case 'integer': {
      let base: z.ZodTypeAny = node.type === 'integer' ? z.number().int() : z.number()
      if (node.enum && node.enum.length > 0) {
        if (!node.enum.every((v): v is number => typeof v === 'number')) {
          throw new InvalidOutputSchemaError('number enum values must all be numbers', path)
        }
        const literals = node.enum.map((v) => z.literal(v))
        if (literals.length === 1) {
          base = literals[0]
        } else {
          base = z.union(literals as unknown as [z.ZodTypeAny, z.ZodTypeAny, ...z.ZodTypeAny[]])
        }
      }
      return node.description ? base.describe(node.description) : base
    }
    case 'boolean': {
      const base = z.boolean()
      return node.description ? base.describe(node.description) : base
    }
    default: {
      const exhaustive: never = node
      throw new InvalidOutputSchemaError(
        `unsupported type \`${(exhaustive as { type?: string }).type ?? 'unknown'}\``,
        path,
      )
    }
  }
}

export type OutputFieldSummary = {
  /** Dot-path within the output object (e.g. `scores.reach`). */
  path: string
  /** Type label suitable for UI display. Includes `[]` suffix for arrays. */
  type: string
  required: boolean
  description?: string
}

/**
 * Flatten a JSON-schema-shaped output into a list of fields, one per leaf
 * (and one per object node with a description). Used by the skill-detail
 * dialog to render an at-a-glance schema, and by the run dialog to look up
 * each declared field in the produced output.
 */
export function summarizeOutputSchema(node: JsonSchemaNode): OutputFieldSummary[] {
  const out: OutputFieldSummary[] = []
  walk(node, '', true, out)
  return out
}

function walk(
  node: JsonSchemaNode,
  path: string,
  required: boolean,
  out: OutputFieldSummary[],
): void {
  if (node.type === 'object') {
    if (path) {
      out.push({ path, type: 'object', required, description: node.description })
    }
    const requiredSet = new Set(node.required ?? [])
    for (const [key, child] of Object.entries(node.properties)) {
      const childPath = path ? `${path}.${key}` : key
      walk(child, childPath, requiredSet.has(key), out)
    }
    return
  }
  if (node.type === 'array') {
    out.push({
      path,
      type: `${labelFor(node.items)}[]`,
      required,
      description: node.description,
    })
    return
  }
  out.push({ path, type: node.type, required, description: node.description })
}

function labelFor(node: JsonSchemaNode): string {
  return node.type
}
