import { confirm } from '@inquirer/prompts'
import { saveConfig } from '../../lib/config.js'
import { log } from '../../lib/log.js'

/**
 * Auto-configure the CLI with the API key from the seed step.
 * Saves config to ~/.hissuno/config.json so `hissuno` commands work immediately.
 */
export async function createConfig(apiKey: string, baseUrl = 'http://localhost:3000'): Promise<void> {
  const shouldConfigure = await confirm({
    message: 'Auto-configure the CLI with the generated API key?',
    default: true,
  })

  if (!shouldConfigure) {
    log.info('Skipping auto-config. Run `hissuno config` later to connect manually.')
    return
  }

  saveConfig({
    api_key: apiKey,
    base_url: baseUrl,
  })

  log.success('CLI configured (~/.hissuno/config.json)')
  log.info('Run `hissuno status` to verify your connection.')
}
