/**
 * Browser Opener Utility
 *
 * Opens a URL in the user's default browser.
 */

import { exec } from 'node:child_process'
import { platform } from 'node:os'

export function openBrowser(url: string): void {
  const cmd = platform() === 'darwin' ? 'open' : platform() === 'win32' ? 'start' : 'xdg-open'
  exec(`${cmd} "${url}"`)
}
