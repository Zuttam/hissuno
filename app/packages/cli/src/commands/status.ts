/**
 * hissuno status - Connection health check
 *
 * Verifies the CLI can reach the configured Hissuno instance
 * and displays connection details.
 */

import { Command } from 'commander'
import { loadConfig } from '../lib/config.js'
import { apiCall } from '../lib/api.js'
import { BOLD, DIM, RESET, GREEN, RED, CYAN, YELLOW } from '../lib/output.js'

export const statusCommand = new Command('status')
  .description('Check connection health')
  .action(async () => {
    const config = loadConfig()

    if (!config) {
      console.log(`\n  ${RED}Not configured${RESET}`)
      console.log(`  ${DIM}Run \`hissuno login\` or \`hissuno config\` to set up.${RESET}\n`)
      process.exit(1)
    }

    console.log(`\n  ${BOLD}${CYAN}Hissuno Status${RESET}\n`)
    console.log(`  ${DIM}URL:${RESET}     ${config.base_url}`)

    if (config.auth_token) {
      console.log(`  ${DIM}Auth:${RESET}    Login session`)
      if (config.username) {
        console.log(`  ${DIM}User:${RESET}    ${config.username}`)
      }
    } else if (config.api_key) {
      console.log(`  ${DIM}Auth:${RESET}    API key (${config.api_key.slice(0, 8)}${'*'.repeat(8)})`)
    }

    if (config.project_id) {
      console.log(`  ${DIM}Project:${RESET} ${config.project_id}`)
    }

    process.stdout.write(`\n  Checking connection... `)

    try {
      const result = await apiCall<{ projects?: { id: string; name: string }[] }>(config, 'GET', '/api/projects')

      if (!result.ok) {
        console.log(`${RED}failed${RESET}`)
        console.log(`  ${RED}HTTP ${result.status}${RESET}`)

        if (result.status === 401) {
          console.log(`  ${DIM}Your credentials may be invalid or expired. Run \`hissuno login\` or \`hissuno config\`.${RESET}`)
        }

        console.log()
        process.exit(1)
      }

      console.log(`${GREEN}connected${RESET}`)

      const projects = Array.isArray(result.data) ? result.data : result.data?.projects
      if (Array.isArray(projects) && projects.length > 0) {
        const project = projects[0]
        console.log(`  ${DIM}Project:${RESET} ${project.name} (${project.id})`)
      }

      console.log()
    } catch (err) {
      console.log(`${RED}failed${RESET}`)

      const message = err instanceof Error ? err.message : 'Unknown error'

      if (message.includes('ECONNREFUSED')) {
        console.log(`  ${YELLOW}Server not reachable at ${config.base_url}${RESET}`)
        console.log(`  ${DIM}Is your Hissuno instance running?${RESET}`)
      } else if (message.includes('ENOTFOUND')) {
        console.log(`  ${YELLOW}Host not found: ${config.base_url}${RESET}`)
        console.log(`  ${DIM}Check the URL in your config. Run \`hissuno config\` to update.${RESET}`)
      } else {
        console.log(`  ${RED}${message}${RESET}`)
      }

      console.log()
      process.exit(1)
    }
  })
