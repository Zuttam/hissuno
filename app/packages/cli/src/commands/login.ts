/**
 * hissuno login - Authenticate via browser (OAuth or credentials)
 *
 * Opens the regular login page. After authentication, a JWT is minted
 * and passed back to the CLI via a localhost callback server.
 */

import http from 'node:http'
import crypto from 'node:crypto'
import { Command } from 'commander'
import { input } from '@inquirer/prompts'
import { loadConfig, saveConfig, type HissunoConfig } from '../lib/config.js'
import { apiCall } from '../lib/api.js'
import { openBrowser } from '../lib/browser.js'
import { success, error, BOLD, DIM, RESET, CYAN } from '../lib/output.js'

export interface CallbackResult {
  token: string
  email: string
  name: string
}

export interface CallbackResponse {
  status: number
  contentType: string
  body: string
  result?: CallbackResult
}

export function handleCallbackRequest(url: URL, expectedState: string): CallbackResponse {
  if (url.pathname !== '/callback') {
    return { status: 404, contentType: 'text/plain', body: 'Not found' }
  }

  const token = url.searchParams.get('token')
  const state = url.searchParams.get('state')
  const email = url.searchParams.get('email') ?? ''
  const name = url.searchParams.get('name') ?? ''

  if (!token || !state) {
    return {
      status: 400,
      contentType: 'text/html',
      body: '<html><body><h2>Authentication failed</h2><p>Missing parameters.</p></body></html>',
    }
  }

  if (state !== expectedState) {
    return {
      status: 403,
      contentType: 'text/html',
      body: '<html><body><h2>Authentication failed</h2><p>State mismatch.</p></body></html>',
    }
  }

  return {
    status: 200,
    contentType: 'text/html',
    body: `<html>
<body style="font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f8fafc;">
  <div style="text-align: center; max-width: 400px;">
    <h2 style="color: #0f172a; margin-bottom: 8px;">Authenticated</h2>
    <p style="color: #64748b;">You can close this tab and return to the terminal.</p>
  </div>
</body>
</html>`,
    result: { token, email, name },
  }
}

function startCallbackServer(expectedState: string, timeoutMs: number): {
  port: number
  result: Promise<CallbackResult>
  cleanup: () => void
} {
  let resolvePromise: (value: CallbackResult) => void
  let rejectPromise: (reason: Error) => void

  const result = new Promise<CallbackResult>((resolve, reject) => {
    resolvePromise = resolve
    rejectPromise = reject
  })

  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost')
    const response = handleCallbackRequest(url, expectedState)

    res.writeHead(response.status, { 'Content-Type': response.contentType })
    res.end(response.body)

    if (response.result) {
      clearTimeout(timer)
      server.close()
      resolvePromise(response.result)
    }
  })

  server.listen(0, '127.0.0.1')

  const addr = server.address()
  const port = typeof addr === 'object' && addr ? addr.port : 0

  const timer = setTimeout(() => {
    server.close()
    rejectPromise(new Error('Login timed out. Please try again.'))
  }, timeoutMs)

  server.on('error', (err) => {
    clearTimeout(timer)
    rejectPromise(err instanceof Error ? err : new Error(String(err)))
  })

  return {
    port,
    result,
    cleanup: () => {
      clearTimeout(timer)
      server.close()
    },
  }
}

export const loginCommand = new Command('login')
  .description('Authenticate via browser login')
  .option('--url <base_url>', 'Hissuno instance URL')
  .option('--token <jwt>', 'Auth token (skip browser flow)')
  .option('--timeout <seconds>', 'Timeout in seconds', '120')
  .action(async (opts) => {
    console.log(`\n${BOLD}${CYAN}Hissuno Login${RESET}`)
    console.log(`${DIM}Authenticate via your browser.${RESET}\n`)

    const existing = loadConfig()
    let baseUrl = opts.url || existing?.base_url

    if (!baseUrl) {
      baseUrl = await input({
        message: 'Hissuno URL:',
        default: 'http://localhost:3000',
        validate: (val) => {
          try {
            new URL(val)
            return true
          } catch {
            return 'Must be a valid URL'
          }
        },
      })
    }

    baseUrl = baseUrl.replace(/\/+$/, '')

    // -----------------------------------------------------------------------
    // Non-interactive: --token provided, skip browser flow entirely
    // -----------------------------------------------------------------------
    if (opts.token) {
      const config: HissunoConfig = {
        auth_token: opts.token,
        base_url: baseUrl,
      }

      process.stdout.write('  Validating token... ')
      try {
        const check = await apiCall<{ projects?: { id: string; name: string }[] }>(config, 'GET', '/api/projects')
        const projects = Array.isArray(check.data) ? check.data : check.data?.projects

        if (!check.ok || !Array.isArray(projects) || projects.length === 0) {
          console.log('')
          error('Token validation failed. Please try again.')
          process.exit(1)
        }

        success('Connected!')

        config.project_id = projects[0].id
        console.log(`  ${DIM}Project:${RESET} ${projects[0].name} (${projects[0].id})`)

        saveConfig(config)
        console.log('')
        success('Configuration saved to ~/.hissuno/config.json')
        console.log(`\n${DIM}Run \`hissuno status\` to verify your connection.${RESET}\n`)
      } catch (err) {
        console.log('')
        error(err instanceof Error ? err.message : 'Token validation failed.')
        process.exit(1)
      }
      return
    }

    // -----------------------------------------------------------------------
    // Interactive: browser-based login flow
    // -----------------------------------------------------------------------
    const timeoutMs = (parseInt(opts.timeout, 10) || 120) * 1000
    const state = crypto.randomBytes(16).toString('hex')

    const { port, result, cleanup } = startCallbackServer(state, timeoutMs)

    if (!port) {
      error('Failed to start local callback server.')
      process.exit(1)
    }

    const redirectTo = `/auth/cli-callback?port=${port}&state=${state}`
    const authUrl = `${baseUrl}/login?redirectTo=${encodeURIComponent(redirectTo)}`

    console.log(`  Opening browser to authenticate...`)
    console.log(`  ${DIM}${authUrl}${RESET}\n`)
    console.log(`  ${DIM}Waiting for authentication (${Math.round(timeoutMs / 1000)}s timeout)...${RESET}`)
    openBrowser(authUrl)

    try {
      const callback = await result
      cleanup()

      const config: HissunoConfig = {
        auth_token: callback.token,
        base_url: baseUrl,
        ...(callback.name ? { username: callback.name } : {}),
      }

      process.stdout.write('\n  Validating token... ')
      const check = await apiCall<{ projects?: { id: string; name: string }[] }>(config, 'GET', '/api/projects')
      const projects = Array.isArray(check.data) ? check.data : check.data?.projects

      if (!check.ok || !Array.isArray(projects) || projects.length === 0) {
        console.log('')
        error('Token validation failed. Please try again.')
        process.exit(1)
      }

      success('Connected!')

      config.project_id = projects[0].id
      console.log(`  ${DIM}User:${RESET}    ${callback.email || callback.name || 'unknown'}`)
      console.log(`  ${DIM}Project:${RESET} ${projects[0].name} (${projects[0].id})`)

      saveConfig(config)
      console.log('')
      success('Configuration saved to ~/.hissuno/config.json')
      console.log(`\n${DIM}Run \`hissuno status\` to verify your connection.${RESET}\n`)
    } catch (err) {
      cleanup()
      console.log('')
      error(err instanceof Error ? err.message : 'Authentication failed.')
      process.exit(1)
    }
  })
