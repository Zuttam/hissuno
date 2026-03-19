import { customType } from 'drizzle-orm/pg-core'

export const vector = customType<{
  data: string
  driverParam: string
  config: { dimensions: number }
}>({
  dataType(config) {
    return `vector(${config?.dimensions ?? 1536})`
  },
})
