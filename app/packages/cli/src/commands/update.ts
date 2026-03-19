/**
 * hissuno update <type> <id> — Update a resource
 */

import { Command } from 'commander'
import { input, select, confirm } from '@inquirer/prompts'
import { requireConfig } from '../lib/config.js'
import { apiCall, resolveProjectId, buildPath } from '../lib/api.js'
import { renderJson, success, error } from '../lib/output.js'

interface ScopeGoal {
  id: string
  text: string
}

async function updateScope(
  existing: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const data: Record<string, unknown> = {}

  const changeName = await confirm({ message: `Change name? (current: ${existing.name})`, default: false })
  if (changeName) {
    data.name = await input({ message: 'New name:', validate: (v) => v.length > 0 || 'Required' })
  }

  const changeType = await confirm({ message: `Change type? (current: ${existing.type})`, default: false })
  if (changeType) {
    data.type = await select({
      message: 'New type:',
      choices: [
        { value: 'product_area', name: 'Product Area' },
        { value: 'initiative', name: 'Initiative' },
      ],
    })
  }

  const changeDesc = await confirm({ message: 'Change description?', default: false })
  if (changeDesc) {
    data.description = await input({ message: 'New description:' })
  }

  const manageGoals = await confirm({ message: 'Manage goals?', default: false })
  if (manageGoals) {
    const existingGoals = (Array.isArray(existing.goals) ? existing.goals : []) as ScopeGoal[]

    if (existingGoals.length > 0) {
      console.log(`\nCurrent goals (${existingGoals.length}):`)
      for (let i = 0; i < existingGoals.length; i++) {
        console.log(`  ${i + 1}. ${existingGoals[i].text}`)
      }
      console.log('')
    }

    const goalAction = await select({
      message: 'Goal action:',
      choices: [
        { value: 'add', name: 'Add new goals' },
        { value: 'replace', name: 'Replace all goals' },
        { value: 'clear', name: 'Clear all goals' },
        { value: 'skip', name: 'Keep current goals' },
      ],
    })

    if (goalAction === 'clear') {
      data.goals = null
    } else if (goalAction === 'replace') {
      const goals: ScopeGoal[] = []
      console.log('Enter new goals (empty text to finish).\n')
      while (goals.length < 10) {
        const text = await input({ message: `Goal ${goals.length + 1} (empty to finish):` })
        if (!text) break
        goals.push({ id: `g_${Date.now()}_${goals.length}`, text })
      }
      data.goals = goals.length > 0 ? goals : null
    } else if (goalAction === 'add') {
      const goals: ScopeGoal[] = [...existingGoals]
      console.log('Enter additional goals (empty text to finish).\n')
      while (goals.length < 10) {
        const text = await input({ message: `Goal ${goals.length + 1} (empty to finish):` })
        if (!text) break
        goals.push({ id: `g_${Date.now()}_${goals.length}`, text })
      }
      data.goals = goals
    }
  }

  return data
}

const TYPE_ENDPOINTS: Record<string, { getPath: (id: string) => string; patchPath: (id: string) => string; key: string }> = {
  scopes: {
    getPath: (id) => `/api/product-scopes/${id}`,
    patchPath: (id) => `/api/product-scopes/${id}`,
    key: 'scope',
  },
}

export const updateCommand = new Command('update')
  .description('Update an existing resource')
  .argument('<type>', 'Resource type: scopes')
  .argument('<id>', 'Resource ID')
  .action(async (type, id, _opts, cmd) => {
    const config = requireConfig()
    const jsonMode = cmd.parent?.opts().json

    const supportedTypes = Object.keys(TYPE_ENDPOINTS)
    if (!supportedTypes.includes(type)) {
      error(`Invalid type "${type}". Updatable types: ${supportedTypes.join(', ')}`)
      process.exit(1)
    }

    const projectId = await resolveProjectId(config)
    const endpoint = TYPE_ENDPOINTS[type]

    // Fetch existing resource
    const getResult = await apiCall<Record<string, unknown>>(
      config,
      'GET',
      buildPath(endpoint.getPath(id), { projectId }),
    )

    if (!getResult.ok) {
      const data = getResult.data as { error?: string }
      error(`Failed to fetch ${type}: ${data.error || `HTTP ${getResult.status}`}`)
      process.exit(1)
    }

    const existing = (getResult.data[endpoint.key] ?? getResult.data) as Record<string, unknown>

    let updates: Record<string, unknown>

    switch (type) {
      case 'scopes':
        updates = await updateScope(existing)
        break
      default:
        error(`Unsupported type: ${type}`)
        process.exit(1)
    }

    if (Object.keys(updates).length === 0) {
      console.log('No changes made.')
      return
    }

    try {
      const result = await apiCall<Record<string, unknown>>(
        config,
        'PATCH',
        buildPath(endpoint.patchPath(id), { projectId }),
        updates,
      )

      if (!result.ok) {
        const errData = result.data as { error?: string }
        error(`Failed: ${errData.error || `HTTP ${result.status}`}`)
        process.exit(1)
      }

      if (jsonMode) {
        console.log(renderJson(result.data))
      } else {
        success('\nUpdated successfully!')
      }
    } catch (err) {
      error(`Failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
      process.exit(1)
    }
  })
