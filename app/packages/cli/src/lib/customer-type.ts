import { error } from './output.js'

export const CUSTOMER_TYPES = ['contacts', 'companies'] as const

export function resolveCustomerType(opt: string | undefined): string {
  const ct = opt ?? 'contacts'
  if (!(CUSTOMER_TYPES as readonly string[]).includes(ct)) {
    error(`Invalid customer type "${ct}". Must be one of: ${CUSTOMER_TYPES.join(', ')}`)
    process.exit(1)
  }
  return ct
}
