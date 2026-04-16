/**
 * hissuno update <type> <id> — Update a resource
 */

import { Command } from 'commander'
import { input, select, confirm } from '@inquirer/prompts'
import { requireConfig } from '../lib/config.js'
import { apiCall, resolveProjectId, buildPath } from '../lib/api.js'
import { renderJson, success, error } from '../lib/output.js'
import { resolveCustomerType } from '../lib/customer-type.js'

interface ScopeGoal {
  id: string
  text: string
}

// ─── Issues ───────────────────────────────────────────────

interface UpdateIssueOpts {
  status?: string
  priority?: string
  name?: string
  description?: string
  issueType?: string
}

export const VALID_ISSUE_STATUSES = ['open', 'ready', 'in_progress', 'resolved', 'closed']
export const VALID_ISSUE_PRIORITIES = ['low', 'medium', 'high']
export const VALID_ISSUE_TYPES = ['bug', 'feature_request', 'change_request']

export async function updateIssue(
  _existing: Record<string, unknown>,
  opts: UpdateIssueOpts,
): Promise<Record<string, unknown>> {
  const data: Record<string, unknown> = {}

  if (opts.status !== undefined) {
    if (!VALID_ISSUE_STATUSES.includes(opts.status)) {
      throw new Error(`Invalid status "${opts.status}". Valid: ${VALID_ISSUE_STATUSES.join(', ')}`)
    }
    data.status = opts.status
  }

  if (opts.priority !== undefined) {
    if (!VALID_ISSUE_PRIORITIES.includes(opts.priority)) {
      throw new Error(`Invalid priority "${opts.priority}". Valid: ${VALID_ISSUE_PRIORITIES.join(', ')}`)
    }
    data.priority = opts.priority
    data.priority_manual_override = true
  }

  if (opts.name !== undefined) data.name = opts.name
  if (opts.description !== undefined) data.description = opts.description

  if (opts.issueType !== undefined) {
    if (!VALID_ISSUE_TYPES.includes(opts.issueType)) {
      throw new Error(`Invalid issue type "${opts.issueType}". Valid: ${VALID_ISSUE_TYPES.join(', ')}`)
    }
    data.type = opts.issueType
  }

  return data
}

// ─── Feedback (sessions) ─────────────────────────────────

interface UpdateFeedbackOpts {
  name?: string
  description?: string
  status?: string
  contactId?: string
}

export const VALID_SESSION_STATUSES = ['active', 'closing_soon', 'awaiting_idle_response', 'closed']

export async function updateFeedback(
  _existing: Record<string, unknown>,
  opts: UpdateFeedbackOpts,
): Promise<Record<string, unknown>> {
  const data: Record<string, unknown> = {}

  if (opts.status !== undefined) {
    if (!VALID_SESSION_STATUSES.includes(opts.status)) {
      throw new Error(`Invalid status "${opts.status}". Valid: ${VALID_SESSION_STATUSES.join(', ')}`)
    }
    data.status = opts.status
  }

  if (opts.name !== undefined) data.name = opts.name
  if (opts.description !== undefined) data.description = opts.description
  if (opts.contactId !== undefined) data.contact_id = opts.contactId || null

  return data
}

// ─── Customers (contacts + companies) ────────────────────

interface UpdateContactOpts {
  name?: string
  email?: string
  companyId?: string
  role?: string
  title?: string
  phone?: string
  isChampion?: string
  notes?: string
}

export async function updateContact(
  _existing: Record<string, unknown>,
  opts: UpdateContactOpts,
): Promise<Record<string, unknown>> {
  const data: Record<string, unknown> = {}

  if (opts.name !== undefined) data.name = opts.name
  if (opts.email !== undefined) data.email = opts.email
  if (opts.companyId !== undefined) data.company_id = opts.companyId || null
  if (opts.role !== undefined) data.role = opts.role || null
  if (opts.title !== undefined) data.title = opts.title || null
  if (opts.phone !== undefined) data.phone = opts.phone || null
  if (opts.notes !== undefined) data.notes = opts.notes || null
  if (opts.isChampion !== undefined) data.is_champion = opts.isChampion === 'true'

  return data
}

interface UpdateCompanyOpts {
  name?: string
  domain?: string
  stage?: string
  industry?: string
  arr?: string
  employeeCount?: string
  planTier?: string
  country?: string
  notes?: string
}

export const VALID_COMPANY_STAGES = ['prospect', 'onboarding', 'active', 'churned', 'expansion']

export async function updateCompany(
  _existing: Record<string, unknown>,
  opts: UpdateCompanyOpts,
): Promise<Record<string, unknown>> {
  const data: Record<string, unknown> = {}

  if (opts.name !== undefined) data.name = opts.name
  if (opts.domain !== undefined) data.domain = opts.domain

  if (opts.stage !== undefined) {
    if (!VALID_COMPANY_STAGES.includes(opts.stage)) {
      throw new Error(`Invalid stage "${opts.stage}". Valid: ${VALID_COMPANY_STAGES.join(', ')}`)
    }
    data.stage = opts.stage
  }

  if (opts.industry !== undefined) data.industry = opts.industry || null
  if (opts.arr !== undefined) data.arr = opts.arr ? Number(opts.arr) : null
  if (opts.employeeCount !== undefined) data.employee_count = opts.employeeCount ? Number(opts.employeeCount) : null
  if (opts.planTier !== undefined) data.plan_tier = opts.planTier || null
  if (opts.country !== undefined) data.country = opts.country || null
  if (opts.notes !== undefined) data.notes = opts.notes || null

  return data
}

// ─── Scopes ──────────────────────────────────────────────

interface UpdateScopeOpts {
  name?: string
  type?: string
  description?: string
  parentId?: string
  content?: string
  goals?: string
  goalsAction?: string
}

async function updateScope(
  existing: Record<string, unknown>,
  opts: UpdateScopeOpts,
): Promise<Record<string, unknown>> {
  const data: Record<string, unknown> = {}

  // Skip interactive prompts for fields not provided when any flag is set
  const nonInteractive = opts.name !== undefined || opts.type !== undefined || opts.description !== undefined || opts.parentId !== undefined || opts.content !== undefined || opts.goals !== undefined || opts.goalsAction === 'clear'

  // Name
  if (opts.name !== undefined) {
    data.name = opts.name
  } else if (!nonInteractive) {
    const changeName = await confirm({ message: `Change name? (current: ${existing.name})`, default: false })
    if (changeName) {
      data.name = await input({ message: 'New name:', validate: (v) => v.length > 0 || 'Required' })
    }
  }

  // Type
  if (opts.type !== undefined) {
    data.type = opts.type
  } else if (!nonInteractive) {
    const changeType = await confirm({ message: `Change type? (current: ${existing.type})`, default: false })
    if (changeType) {
      data.type = await select({
        message: 'New type:',
        choices: [
          { value: 'product_area', name: 'Product Area' },
          { value: 'initiative', name: 'Initiative' },
          { value: 'experiment', name: 'Experiment' },
        ],
      })
    }
  }

  // Description
  if (opts.description !== undefined) {
    data.description = opts.description
  } else if (!nonInteractive) {
    const changeDesc = await confirm({ message: 'Change description?', default: false })
    if (changeDesc) {
      data.description = await input({ message: 'New description:' })
    }
  }

  // Parent ID
  if (opts.parentId !== undefined) {
    data.parent_id = opts.parentId || null
  }

  // Content
  if (opts.content !== undefined) {
    data.content = opts.content || null
  }

  // Goals
  if (opts.goals !== undefined || opts.goalsAction === 'clear') {
    const goalsAction = opts.goalsAction || 'replace'

    if (goalsAction === 'clear') {
      data.goals = null
    } else if (opts.goals) {
      const goalTexts = opts.goals.split(',').map(g => g.trim()).filter(Boolean)
      const goals = goalTexts.map((text, i) => ({ id: `g_${Date.now()}_${i}`, text }))

      if (goalsAction === 'add') {
        const existingGoals = (Array.isArray(existing.goals) ? existing.goals : []) as ScopeGoal[]
        data.goals = [...existingGoals, ...goals]
      } else {
        // replace (default)
        data.goals = goals.length > 0 ? goals : null
      }
    }
  } else if (!nonInteractive) {
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
  }

  return data
}

// ─── Endpoint config ─────────────────────────────────────

interface TypeEndpoint {
  getPath: (id: string) => string
  patchPath: (id: string) => string
  key: string
}

const TYPE_ENDPOINTS: Record<string, TypeEndpoint> = {
  scopes: {
    getPath: (id) => `/api/product-scopes/${id}`,
    patchPath: (id) => `/api/product-scopes/${id}`,
    key: 'scope',
  },
  issues: {
    getPath: (id) => `/api/issues/${id}`,
    patchPath: (id) => `/api/issues/${id}`,
    key: 'issue',
  },
  feedback: {
    getPath: (id) => `/api/sessions/${id}`,
    patchPath: (id) => `/api/sessions/${id}`,
    key: 'session',
  },
  // customers resolved dynamically in action handler
}

function resolveEndpoint(type: string, opts: Record<string, unknown>): TypeEndpoint {
  if (type === 'customers') {
    const customerType = resolveCustomerType(opts.customerType as string | undefined)
    return {
      getPath: (id) => `/api/${customerType}/${id}`,
      patchPath: (id) => `/api/${customerType}/${id}`,
      key: customerType === 'companies' ? 'company' : 'contact',
    }
  }

  const endpoint = TYPE_ENDPOINTS[type]
  if (!endpoint) {
    error(`Invalid type "${type}". Updatable types: scopes, issues, feedback, customers`)
    process.exit(1)
  }
  return endpoint
}

// ─── Command ─────────────────────────────────────────────

export const updateCommand = new Command('update')
  .description('Update an existing resource')
  .argument('<type>', 'Resource type: scopes, issues, feedback, customers')
  .argument('<id>', 'Resource ID')
  // Shared options
  .option('--name <text>', 'New name/title')
  .option('--description <text>', 'New description')
  // Scope options
  .option('--type <type>', 'Scope type (product_area, initiative, experiment)')
  .option('--parent-id <id>', 'Parent scope ID (empty string to clear)')
  .option('--content <text>', 'Markdown content (empty string to clear)')
  .option('--goals <goals>', 'Comma-separated goals')
  .option('--goals-action <action>', 'Goal action: add, replace, clear', 'replace')
  // Issue options
  .option('--status <status>', 'Status (varies by type)')
  .option('--priority <priority>', 'Issue priority: low, medium, high')
  .option('--issue-type <type>', 'Issue type: bug, feature_request, change_request')
  // Customer options
  .option('--customer-type <type>', 'Customer sub-type: contacts (default) or companies')
  .option('--email <email>', 'Contact email')
  .option('--company-id <id>', 'Contact company ID (empty string to clear)')
  .option('--role <role>', 'Contact role')
  .option('--title <title>', 'Contact title')
  .option('--phone <phone>', 'Contact phone')
  .option('--is-champion <bool>', 'Contact is champion: true or false')
  .option('--domain <domain>', 'Company domain')
  .option('--stage <stage>', 'Company stage: prospect, onboarding, active, churned, expansion')
  .option('--industry <industry>', 'Company industry')
  .option('--arr <amount>', 'Company ARR')
  .option('--employee-count <count>', 'Company employee count')
  .option('--plan-tier <tier>', 'Company plan tier')
  .option('--country <country>', 'Company country')
  .option('--notes <text>', 'Notes')
  // Feedback options
  .option('--contact-id <id>', 'Feedback contact ID (empty string to clear)')
  .action(async (type, id, opts, cmd) => {
    const config = requireConfig()
    const jsonMode = cmd.parent?.opts().json

    const supportedTypes = ['scopes', 'issues', 'feedback', 'customers']
    if (!supportedTypes.includes(type)) {
      error(`Invalid type "${type}". Updatable types: ${supportedTypes.join(', ')}`)
      process.exit(1)
    }

    const projectId = await resolveProjectId(config)
    const endpoint = resolveEndpoint(type, opts)

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
        updates = await updateScope(existing, opts)
        break
      case 'issues':
        updates = await updateIssue(existing, opts)
        break
      case 'feedback':
        updates = await updateFeedback(existing, opts)
        break
      case 'customers': {
        const customerType = resolveCustomerType(opts.customerType)
        if (customerType === 'companies') {
          updates = await updateCompany(existing, opts)
        } else {
          updates = await updateContact(existing, opts)
        }
        break
      }
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
