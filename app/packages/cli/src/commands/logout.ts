/**
 * hissuno logout - Clear the CLI access token from config.
 */

import { Command } from 'commander'
import { loadConfig, saveConfig } from '../lib/config.js'
import { success, DIM, BOLD, RESET, CYAN } from '../lib/output.js'

export const logoutCommand = new Command('logout')
  .description('Log out and clear CLI access token')
  .action(async () => {
    const config = loadConfig()

    if (!config?.auth_token) {
      console.log(`\n  ${DIM}No active login session found.${RESET}\n`)
      return
    }

    console.log(`\n${BOLD}${CYAN}Hissuno Logout${RESET}\n`)

    delete config.auth_token
    saveConfig(config)
    success('Logged out. Token removed from ~/.hissuno/config.json')
    console.log()
  })
