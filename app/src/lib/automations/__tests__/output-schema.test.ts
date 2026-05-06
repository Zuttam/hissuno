import { describe, expect, it } from 'vitest'
import {
  InvalidOutputSchemaError,
  jsonSchemaToZod,
  summarizeOutputSchema,
} from '../output-schema'
import type { JsonSchemaNode } from '../types'

describe('jsonSchemaToZod', () => {
  it('parses a nested object with required and optional fields', () => {
    const schema: JsonSchemaNode = {
      type: 'object',
      properties: {
        issueId: { type: 'string' },
        scores: {
          type: 'object',
          properties: {
            reach: { type: 'integer' },
            impact: { type: 'integer' },
          },
          required: ['reach', 'impact'],
        },
        note: { type: 'string' },
      },
      required: ['issueId', 'scores'],
    }

    const zod = jsonSchemaToZod(schema)
    expect(
      zod.safeParse({
        issueId: 'iss_1',
        scores: { reach: 4, impact: 3 },
      }).success,
    ).toBe(true)
    // Missing required field
    expect(zod.safeParse({ scores: { reach: 4, impact: 3 } }).success).toBe(false)
    // Required nested field missing
    expect(
      zod.safeParse({ issueId: 'iss_1', scores: { reach: 4 } }).success,
    ).toBe(false)
  })

  it('validates an array of primitives', () => {
    const schema: JsonSchemaNode = {
      type: 'object',
      properties: { tags: { type: 'array', items: { type: 'string' } } },
      required: ['tags'],
    }
    const zod = jsonSchemaToZod(schema)
    expect(zod.safeParse({ tags: ['a', 'b'] }).success).toBe(true)
    expect(zod.safeParse({ tags: [1] }).success).toBe(false)
  })

  it('validates a string enum', () => {
    const schema: JsonSchemaNode = {
      type: 'string',
      enum: ['trivial', 'small', 'medium'],
    }
    const zod = jsonSchemaToZod(schema)
    expect(zod.safeParse('small').success).toBe(true)
    expect(zod.safeParse('huge').success).toBe(false)
  })

  it('rejects integers that are not whole numbers', () => {
    const zod = jsonSchemaToZod({ type: 'integer' })
    expect(zod.safeParse(3).success).toBe(true)
    expect(zod.safeParse(3.5).success).toBe(false)
  })

  it('throws InvalidOutputSchemaError for unsupported type', () => {
    expect(() =>
      jsonSchemaToZod({ type: 'whatever' } as unknown as JsonSchemaNode),
    ).toThrow(InvalidOutputSchemaError)
  })

  it('throws when an object node is missing properties', () => {
    expect(() =>
      jsonSchemaToZod({ type: 'object' } as unknown as JsonSchemaNode),
    ).toThrow(/properties/)
  })
})

describe('summarizeOutputSchema', () => {
  it('flattens a nested object schema into dot-paths', () => {
    const schema: JsonSchemaNode = {
      type: 'object',
      properties: {
        issueId: { type: 'string' },
        scores: {
          type: 'object',
          properties: {
            reach: { type: 'integer' },
          },
          required: ['reach'],
        },
        tags: { type: 'array', items: { type: 'string' } },
      },
      required: ['issueId', 'scores'],
    }
    const fields = summarizeOutputSchema(schema)
    const byPath = Object.fromEntries(fields.map((f) => [f.path, f]))
    expect(byPath['issueId']).toEqual({
      path: 'issueId',
      type: 'string',
      required: true,
      description: undefined,
    })
    expect(byPath['scores'].type).toBe('object')
    expect(byPath['scores'].required).toBe(true)
    expect(byPath['scores.reach'].type).toBe('integer')
    expect(byPath['scores.reach'].required).toBe(true)
    expect(byPath['tags'].type).toBe('string[]')
    expect(byPath['tags'].required).toBe(false)
  })
})
