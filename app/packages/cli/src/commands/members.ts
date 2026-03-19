/**
 * hissuno members - List project members
 *
 *   hissuno members          List all members of the current project
 */

import { Command } from 'commander'
import { requireConfig } from '../lib/config.js'
import { apiCall, resolveProjectId, buildPath } from '../lib/api.js'
import { renderJson, error, BOLD, DIM, RESET, CYAN, GREEN, YELLOW } from '../lib/output.js'

interface Member {
  id: string
  role: string
  status: string
  created_at: string
  invited_email?: string
  user_profile?: {
    full_name?: string
    email?: string
  }
}

function roleBadge(role: string): string {
  return role === 'owner' ? `${CYAN}${role}${RESET}` : `${DIM}${role}${RESET}`
}

function statusBadge(status: string): string {
  return status === 'active' ? `${GREEN}${status}${RESET}` : `${YELLOW}${status}${RESET}`
}

export const membersCommand = new Command('members')
  .description('List project members')
  .action(async (_, cmd) => {
    const config = requireConfig()
    const jsonMode = cmd.parent?.opts().json

    const projectId = await resolveProjectId(config)
    const path = buildPath('/api/members', { projectId })
    const result = await apiCall<{ members: Member[] }>(config, 'GET', path)

    if (!result.ok) {
      if (jsonMode) {
        console.log(renderJson({ error: `HTTP ${result.status}` }))
      } else {
        error(`Failed to list members (HTTP ${result.status}).`)
      }
      process.exit(1)
    }

    const members = result.data?.members ?? []

    if (jsonMode) {
      console.log(renderJson(members))
      return
    }

    console.log(`\n  ${BOLD}${CYAN}Project Members (${members.length})${RESET}\n`)

    if (members.length === 0) {
      console.log(`  ${DIM}No members found.${RESET}\n`)
      return
    }

    // Column widths
    const nameWidth = 24
    const emailWidth = 28
    const roleWidth = 10
    const statusWidth = 10

    // Header
    console.log(
      `  ${DIM}${'NAME'.padEnd(nameWidth)}${'EMAIL'.padEnd(emailWidth)}${'ROLE'.padEnd(roleWidth)}${'STATUS'.padEnd(statusWidth)}ADDED${RESET}`
    )
    console.log(`  ${DIM}${'-'.repeat(nameWidth + emailWidth + roleWidth + statusWidth + 12)}${RESET}`)

    for (const m of members) {
      const name = (m.user_profile?.full_name || m.invited_email || 'Unknown').slice(0, nameWidth - 2)
      const email = (m.user_profile?.email || m.invited_email || '').slice(0, emailWidth - 2)
      const date = new Date(m.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

      // Print with inline ANSI badges (pad the raw text, then replace with colored version)
      console.log(
        `  ${BOLD}${name.padEnd(nameWidth)}${RESET}${email.padEnd(emailWidth)}${roleBadge(m.role.padEnd(roleWidth))}${statusBadge(m.status.padEnd(statusWidth))}${DIM}${date}${RESET}`
      )
    }

    console.log()
  })
