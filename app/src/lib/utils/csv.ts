/**
 * CSV generation utility for exporting table data
 */

export interface CSVColumn<T> {
  key: keyof T | string
  header: string
  transform?: (value: unknown, row: T) => string
}

/**
 * Escapes a value for CSV format
 * - Wraps in quotes if contains comma, newline, or quote
 * - Escapes quotes by doubling them
 */
function escapeCSVValue(value: unknown): string {
  if (value === null || value === undefined) {
    return ''
  }

  const str = String(value)

  // Check if we need to quote this value
  if (str.includes(',') || str.includes('\n') || str.includes('\r') || str.includes('"')) {
    // Escape quotes by doubling them and wrap in quotes
    return `"${str.replace(/"/g, '""')}"`
  }

  return str
}

/**
 * Gets a nested value from an object using dot notation
 * e.g., getNestedValue(obj, 'project.name') returns obj.project.name
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce((acc: unknown, part) => {
    if (acc && typeof acc === 'object') {
      return (acc as Record<string, unknown>)[part]
    }
    return undefined
  }, obj)
}

/**
 * Generates a CSV string from an array of data objects
 *
 * @param data - Array of objects to convert to CSV
 * @param columns - Column definitions with keys, headers, and optional transformers
 * @returns CSV string with headers and data rows
 */
export function generateCSV<T>(
  data: T[],
  columns: CSVColumn<T>[]
): string {
  // Generate header row
  const headerRow = columns.map((col) => escapeCSVValue(col.header)).join(',')

  // Generate data rows
  const dataRows = data.map((row) => {
    return columns
      .map((col) => {
        const rawValue = getNestedValue(row as unknown as Record<string, unknown>, col.key as string)
        const value = col.transform ? col.transform(rawValue, row) : rawValue
        return escapeCSVValue(value)
      })
      .join(',')
  })

  return [headerRow, ...dataRows].join('\n')
}

/**
 * Formats a date for CSV export
 */
export function formatDateForCSV(dateStr: string | null | undefined): string {
  if (!dateStr) return ''
  try {
    return new Date(dateStr).toISOString()
  } catch {
    return ''
  }
}

/**
 * Formats an array for CSV export (joins with semicolons)
 */
export function formatArrayForCSV(arr: unknown[] | null | undefined): string {
  if (!arr || !Array.isArray(arr)) return ''
  return arr.join('; ')
}
