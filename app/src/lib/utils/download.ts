/**
 * File download utility for client-side downloads
 */

/**
 * Downloads content as a file in the browser
 *
 * @param content - The file content as a string
 * @param filename - The name of the file to download
 * @param mimeType - The MIME type of the file (e.g., 'text/csv', 'text/markdown')
 */
export function downloadAsFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()

  // Cleanup
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Downloads content as a CSV file
 *
 * @param content - The CSV content as a string
 * @param filename - The name of the file (should end with .csv)
 */
export function downloadAsCSV(content: string, filename: string): void {
  downloadAsFile(content, filename, 'text/csv;charset=utf-8')
}

/**
 * Generates a filename with the current date
 *
 * @param prefix - The prefix for the filename (e.g., 'issues', 'sessions')
 * @param suffix - Optional suffix before the extension (e.g., project name)
 * @param extension - The file extension (default: 'csv')
 * @returns Formatted filename like 'issues-myproject-2026-01-24.csv'
 */
export function generateExportFilename(
  prefix: string,
  suffix?: string,
  extension: string = 'csv'
): string {
  const date = new Date().toISOString().split('T')[0]
  const parts = [prefix]

  if (suffix) {
    // Sanitize suffix: lowercase, replace spaces with hyphens, remove special chars
    const sanitized = suffix
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
    parts.push(sanitized)
  }

  parts.push(date)

  return `${parts.join('-')}.${extension}`
}
