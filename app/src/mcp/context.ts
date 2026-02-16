/**
 * MCP Server Auth Context
 *
 * Passed to tool handlers via AsyncLocalStorage.
 * Two modes: user (full project access) and contact (scoped to one contact).
 */

import { AsyncLocalStorage } from 'node:async_hooks'

export interface McpUserContext {
  mode: 'user'
  projectId: string
  keyId: string
  createdByUserId: string
}

export interface McpContactContext {
  mode: 'contact'
  projectId: string
  keyId: string
  createdByUserId: string
  contactId: string
  contactEmail: string
}

export type McpContext = McpUserContext | McpContactContext

const mcpContextStorage = new AsyncLocalStorage<McpContext>()

/**
 * Run a function with MCP context available via getContext().
 */
export function runWithContext<T>(context: McpContext, fn: () => T): T {
  return mcpContextStorage.run(context, fn)
}

/**
 * Get the current MCP context. Throws if called outside runWithContext().
 */
export function getContext(): McpContext {
  const ctx = mcpContextStorage.getStore()
  if (!ctx) {
    throw new Error('MCP context not available — called outside request handler')
  }
  return ctx
}

/**
 * Get the current context narrowed to user mode. Throws if in contact mode.
 */
export function getUserContext(): McpUserContext {
  const ctx = getContext()
  if (ctx.mode !== 'user') {
    throw new Error('Expected user mode context')
  }
  return ctx
}

/**
 * Get the current context narrowed to contact mode. Throws if in user mode.
 */
export function getContactContext(): McpContactContext {
  const ctx = getContext()
  if (ctx.mode !== 'contact') {
    throw new Error('Expected contact mode context')
  }
  return ctx
}
