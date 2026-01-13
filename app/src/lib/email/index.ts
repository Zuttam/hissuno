/**
 * Email service barrel export
 *
 * Re-exports email utilities for convenience.
 */

export { isResendConfigured, getResendClient, getFromAddress } from './resend'
export type { SendEmailResult } from './types'
