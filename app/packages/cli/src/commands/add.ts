/**
 * hissuno add <type> — Interactively create a resource
 *
 * All interactive prompts can be skipped via CLI flags (prompt-or-param pattern).
 * Mixed mode is supported: provide some flags and answer the remaining prompts.
 */

import { Command } from 'commander'
import { input, select, confirm } from '@inquirer/prompts'
import { requireConfig } from '../lib/config.js'
import { apiCall, resolveProjectId, buildPath } from '../lib/api.js'
import { renderJson, success, error } from '../lib/output.js'
import { resolveCustomerType } from '../lib/customer-type.js'

type AddOpts = Record<string, string | boolean | undefined>

const ISSUE_TYPES = ['bug', 'feature_request', 'change_request'] as const
const PRIORITIES = ['low', 'medium', 'high'] as const
const SCOPE_TYPES = ['product_area', 'initiative'] as const
const STAGES = ['prospect', 'onboarding', 'active', 'churned', 'expansion'] as const

async function addIssue(opts: AddOpts): Promise<Record<string, unknown>> {
  let type: string
  if (opts.type) {
    if (!ISSUE_TYPES.includes(opts.type as (typeof ISSUE_TYPES)[number])) {
      error(`Invalid issue type "${opts.type}". Must be one of: ${ISSUE_TYPES.join(', ')}`)
      process.exit(1)
    }
    type = opts.type as string
  } else {
    type = await select({
      message: 'Issue type:',
      choices: [
        { value: 'bug', name: 'Bug' },
        { value: 'feature_request', name: 'Feature Request' },
        { value: 'change_request', name: 'Change Request' },
      ],
    })
  }

  const name =
    (opts.title as string) ||
    (await input({ message: 'Title:', validate: (v) => v.length > 0 || 'Required' }))
  if (!name) {
    error('Title is required.')
    process.exit(1)
  }

  const description =
    (opts.description as string) ||
    (await input({ message: 'Description:', validate: (v) => v.length > 0 || 'Required' }))
  if (!description) {
    error('Description is required.')
    process.exit(1)
  }

  // Skip optional priority prompt when required fields were provided as flags
  const nonInteractive = Boolean(opts.type && opts.title)

  let priority: string | undefined
  if (opts.priority !== undefined) {
    if (!PRIORITIES.includes(opts.priority as (typeof PRIORITIES)[number])) {
      error(`Invalid priority "${opts.priority}". Must be one of: ${PRIORITIES.join(', ')}`)
      process.exit(1)
    }
    priority = opts.priority as string
  } else if (!nonInteractive) {
    const hasPriority = await confirm({ message: 'Set priority?', default: false })
    if (hasPriority) {
      priority = await select({
        message: 'Priority:',
        choices: [
          { value: 'low', name: 'Low' },
          { value: 'medium', name: 'Medium' },
          { value: 'high', name: 'High' },
        ],
      })
    }
  }

  return { type, name, description, ...(priority ? { priority } : {}) }
}

async function addContact(opts: AddOpts): Promise<Record<string, unknown>> {
  const name =
    (opts.name as string) ||
    (await input({ message: 'Name:', validate: (v) => v.length > 0 || 'Required' }))
  if (!name) {
    error('Name is required.')
    process.exit(1)
  }

  let email: string
  if (opts.email) {
    if (!(opts.email as string).includes('@')) {
      error('Invalid email: must contain "@".')
      process.exit(1)
    }
    email = opts.email as string
  } else {
    email = await input({
      message: 'Email:',
      validate: (v) => (v.includes('@') ? true : 'Must be a valid email'),
    })
  }

  const data: Record<string, unknown> = { name, email }

  // Skip optional prompts when required fields were provided as flags
  const nonInteractive = Boolean(opts.name && opts.email)

  const role =
    opts.role !== undefined
      ? (opts.role as string)
      : nonInteractive ? '' : await input({ message: 'Role (optional):' })
  if (role) data.role = role

  const title =
    opts.title !== undefined
      ? (opts.title as string)
      : nonInteractive ? '' : await input({ message: 'Title (optional):' })
  if (title) data.title = title

  const phone =
    opts.phone !== undefined
      ? (opts.phone as string)
      : nonInteractive ? '' : await input({ message: 'Phone (optional):' })
  if (phone) data.phone = phone

  const companyId =
    opts.companyId !== undefined
      ? (opts.companyId as string)
      : nonInteractive ? '' : await input({ message: 'Company ID (optional):' })
  if (companyId) data.company_id = companyId

  const isChampion =
    opts.champion !== undefined
      ? Boolean(opts.champion)
      : nonInteractive ? false : await confirm({ message: 'Is champion?', default: false })
  if (isChampion) data.is_champion = true

  return data
}

async function addCompany(opts: AddOpts): Promise<Record<string, unknown>> {
  const name =
    (opts.name as string) ||
    (await input({ message: 'Company name:', validate: (v) => v.length > 0 || 'Required' }))
  if (!name) {
    error('Company name is required.')
    process.exit(1)
  }

  const domain =
    (opts.domain as string) ||
    (await input({
      message: 'Domain (e.g., acme.com):',
      validate: (v) => v.length > 0 || 'Required',
    }))
  if (!domain) {
    error('Domain is required.')
    process.exit(1)
  }

  const data: Record<string, unknown> = { name, domain }

  // Skip optional prompts when required fields were provided as flags
  const nonInteractive = Boolean(opts.name && opts.domain)

  const industry =
    opts.industry !== undefined
      ? (opts.industry as string)
      : nonInteractive ? '' : await input({ message: 'Industry (optional):' })
  if (industry) data.industry = industry

  if (opts.arr !== undefined) {
    const arrNum = Number(opts.arr)
    if (isNaN(arrNum)) {
      error(`Invalid ARR value "${opts.arr}". Must be a number.`)
      process.exit(1)
    }
    data.arr = arrNum
  } else if (!nonInteractive) {
    const arrStr = await input({ message: 'ARR (optional, number):' })
    if (arrStr) data.arr = Number(arrStr)
  }

  if (opts.stage !== undefined) {
    if (!STAGES.includes(opts.stage as (typeof STAGES)[number])) {
      error(`Invalid stage "${opts.stage}". Must be one of: ${STAGES.join(', ')}`)
      process.exit(1)
    }
    data.stage = opts.stage as string
  } else if (!nonInteractive) {
    const hasStage = await confirm({ message: 'Set stage?', default: false })
    if (hasStage) {
      const stage = await select({
        message: 'Stage:',
        choices: [
          { value: 'prospect', name: 'Prospect' },
          { value: 'onboarding', name: 'Onboarding' },
          { value: 'active', name: 'Active' },
          { value: 'churned', name: 'Churned' },
          { value: 'expansion', name: 'Expansion' },
        ],
      })
      data.stage = stage
    }
  }

  if (opts.employeeCount !== undefined) {
    const ecNum = Number(opts.employeeCount)
    if (isNaN(ecNum)) {
      error(`Invalid employee count "${opts.employeeCount}". Must be a number.`)
      process.exit(1)
    }
    data.employee_count = ecNum
  } else if (!nonInteractive) {
    const employeeCountStr = await input({ message: 'Employee count (optional, number):' })
    if (employeeCountStr) data.employee_count = Number(employeeCountStr)
  }

  const planTier =
    opts.planTier !== undefined
      ? (opts.planTier as string)
      : nonInteractive ? '' : await input({ message: 'Plan tier (optional):' })
  if (planTier) data.plan_tier = planTier

  const country =
    opts.country !== undefined
      ? (opts.country as string)
      : nonInteractive ? '' : await input({ message: 'Country (optional):' })
  if (country) data.country = country

  const notes =
    opts.notes !== undefined
      ? (opts.notes as string)
      : nonInteractive ? '' : await input({ message: 'Notes (optional):' })
  if (notes) data.notes = notes

  return data
}

async function addScope(opts: AddOpts): Promise<Record<string, unknown>> {
  const name =
    (opts.name as string) ||
    (await input({ message: 'Name:', validate: (v) => v.length > 0 || 'Required' }))
  if (!name) {
    error('Name is required.')
    process.exit(1)
  }

  let type: string
  if (opts.type) {
    if (!SCOPE_TYPES.includes(opts.type as (typeof SCOPE_TYPES)[number])) {
      error(`Invalid scope type "${opts.type}". Must be one of: ${SCOPE_TYPES.join(', ')}`)
      process.exit(1)
    }
    type = opts.type as string
  } else {
    type = await select({
      message: 'Type:',
      choices: [
        { value: 'product_area', name: 'Product Area' },
        { value: 'initiative', name: 'Initiative' },
      ],
    })
  }

  // Skip optional prompts when required fields were provided as flags
  const nonInteractive = Boolean(opts.name && opts.type)

  const description =
    opts.description !== undefined
      ? (opts.description as string)
      : nonInteractive ? '' : await input({ message: 'Description (optional):' })

  const data: Record<string, unknown> = { name, type }
  if (description) data.description = description

  // Goals
  if (opts.goals !== undefined) {
    const goalTexts = (opts.goals as string)
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
    if (goalTexts.length > 0) {
      data.goals = goalTexts.map((text, i) => ({ id: `g_${Date.now()}_${i}`, text }))
    }
  } else if (!nonInteractive) {
    const addGoals = await confirm({ message: 'Add goals?', default: false })
    if (addGoals) {
      const goals: Array<{ id: string; text: string }> = []
      console.log('Enter goals (empty text to finish).\n')
      while (goals.length < 10) {
        const text = await input({
          message: `Goal ${goals.length + 1} (empty to finish):`,
        })
        if (!text) break
        goals.push({ id: `g_${Date.now()}_${goals.length}`, text })
      }
      if (goals.length > 0) data.goals = goals
    }
  }

  return data
}

/** Normalize common role aliases to the API-expected values. */
function normalizeRole(role: string): string {
  const aliases: Record<string, string> = {
    customer: 'user',
    agent: 'assistant',
    human: 'user',
    bot: 'assistant',
    support: 'assistant',
  }
  return aliases[role.toLowerCase()] ?? role
}

const VALID_MESSAGE_ROLES = new Set(['user', 'assistant'])

async function addFeedback(opts: AddOpts): Promise<Record<string, unknown>> {
  const hasTranscript = opts.transcript !== undefined
  const hasMessages = opts.messages !== undefined

  if (hasTranscript && hasMessages) {
    error('Cannot use both --messages and --transcript. Use --messages for turn-based conversations, --transcript for raw text.')
    process.exit(1)
  }

  const data: Record<string, unknown> = {}

  if (hasTranscript) {
    // Transcript mode: raw text, no turn structure
    const transcript = opts.transcript as string
    if (!transcript.trim()) {
      error('--transcript value must not be empty.')
      process.exit(1)
    }
    data.messages = [{ role: 'user', content: transcript.trim() }]
    data.session_type = 'meeting'
  } else if (hasMessages) {
    // Turn-based mode with strict validation
    let messages: Array<{ role: string; content: string }>
    try {
      messages = JSON.parse(opts.messages as string)
    } catch {
      error('Invalid --messages value. Must be a valid JSON array.')
      process.exit(1)
    }
    if (!Array.isArray(messages) || messages.length === 0) {
      error('--messages must be a non-empty JSON array.')
      process.exit(1)
    }
    for (const msg of messages) {
      if (!msg.role || !msg.content) {
        error('Each message must have "role" and "content" fields.')
        process.exit(1)
      }
      const normalized = normalizeRole(msg.role)
      if (!VALID_MESSAGE_ROLES.has(normalized)) {
        error(`Invalid message role "${msg.role}". Must be one of: user, assistant (aliases: customer, agent, human, bot, support).`)
        process.exit(1)
      }
      msg.role = normalized
    }
    data.messages = messages
  } else {
    // Interactive mode
    const messages: Array<{ role: string; content: string }> = []

    console.log('Enter conversation messages (at least 1 required). Empty content to finish.\n')

    let first = true
    while (true) {
      const role = await select({
        message: `Message ${messages.length + 1} role:`,
        choices: [
          { value: 'user', name: 'User (customer)' },
          { value: 'assistant', name: 'Assistant (support)' },
        ],
        default: first ? 'user' : undefined,
      })

      const content = await input({
        message: `Message ${messages.length + 1} content (empty to finish):`,
      })

      if (!content) break

      messages.push({ role, content })
      first = false
    }

    if (messages.length === 0) {
      error('At least one message is required.')
      process.exit(1)
    }
    data.messages = messages
  }

  // Skip optional prompts when content was provided as a flag
  const nonInteractive = hasMessages || hasTranscript

  const feedbackName =
    opts.name !== undefined
      ? (opts.name as string)
      : nonInteractive ? '' : await input({ message: 'Feedback name/title (optional):' })
  if (feedbackName) data.name = feedbackName

  if (opts.tags !== undefined) {
    const tagList = (opts.tags as string)
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
    if (tagList.length > 0) data.tags = tagList
  } else if (!nonInteractive) {
    const tags = await input({ message: 'Tags (comma-separated, optional):' })
    if (tags) data.tags = tags.split(',').map((t) => t.trim())
  }

  // Contact email - resolve or create a contact for this feedback
  if (opts.contactEmail !== undefined) {
    const email = opts.contactEmail as string
    if (!email.includes('@')) {
      error('Invalid --contact-email: must contain "@".')
      process.exit(1)
    }
    data.contact_email = email
  }

  return data
}

const TYPE_ENDPOINTS: Record<string, string> = {
  feedback: '/api/sessions',
  issues: '/api/issues',
  customers: '/api/contacts',
  scopes: '/api/product-scopes',
}

export const addCommand = new Command('add')
  .description('Create a new resource interactively')
  .argument('<type>', 'Resource type: feedback, issues, customers, scopes')
  .option('--customer-type <type>', 'Customer sub-type: contacts (default) or companies')
  .option('--type <type>', 'Issue type (bug, feature_request, change_request) or scope type (product_area, initiative)')
  .option('--title <text>', 'Title for issues')
  .option('--description <text>', 'Description')
  .option('--priority <priority>', 'Priority (low, medium, high)')
  .option('--name <text>', 'Name for contacts, companies, scopes, or feedback')
  .option('--email <text>', 'Email for contacts')
  .option('--role <text>', 'Role for contacts')
  .option('--phone <text>', 'Phone for contacts')
  .option('--company-id <id>', 'Company ID for contacts')
  .option('--champion', 'Boolean flag for contacts')
  .option('--domain <text>', 'Domain for companies')
  .option('--industry <text>', 'Industry for companies')
  .option('--arr <number>', 'ARR for companies')
  .option('--stage <stage>', 'Stage for companies (prospect, onboarding, active, churned, expansion)')
  .option('--employee-count <number>', 'Employee count for companies')
  .option('--plan-tier <text>', 'Plan tier for companies')
  .option('--country <text>', 'Country for companies')
  .option('--notes <text>', 'Notes for companies')
  .option('--messages <json>', 'JSON array of messages for feedback (roles: user, assistant)')
  .option('--transcript <text>', 'Raw transcript text for non-turn-based feedback (e.g. meeting)')
  .option('--tags <tags>', 'Comma-separated tags for feedback')
  .option('--contact-email <email>', 'Contact email for feedback (resolves or creates a contact)')
  .option('--goals <goals>', 'Comma-separated goals for scopes')
  .action(async (type, opts, cmd) => {
    const config = requireConfig()
    const jsonMode = cmd.parent?.opts().json

    const supportedTypes = Object.keys(TYPE_ENDPOINTS)
    if (!supportedTypes.includes(type)) {
      if (type === 'knowledge') {
        error('Knowledge sources cannot be added via CLI. Use the Hissuno dashboard.')
      } else {
        error(`Invalid type "${type}". Must be one of: ${supportedTypes.join(', ')}`)
      }
      process.exit(1)
    }

    let data: Record<string, unknown>
    let apiEndpoint = TYPE_ENDPOINTS[type]

    switch (type) {
      case 'issues':
        data = await addIssue(opts)
        break
      case 'customers': {
        let customerType = opts.customerType as string | undefined
        if (!customerType) {
          customerType = await select({
            message: 'Customer type:',
            choices: [
              { value: 'contacts', name: 'Contact (individual person)' },
              { value: 'companies', name: 'Company (organization)' },
            ],
          })
        }
        customerType = resolveCustomerType(customerType)
        apiEndpoint = `/api/${customerType}`
        data = customerType === 'companies' ? await addCompany(opts) : await addContact(opts)
        break
      }
      case 'feedback':
        data = await addFeedback(opts)
        break
      case 'scopes':
        data = await addScope(opts)
        break
      default:
        error(`Unsupported type: ${type}`)
        process.exit(1)
    }

    const projectId = await resolveProjectId(config)

    try {
      const result = await apiCall<Record<string, unknown>>(
        config,
        'POST',
        buildPath(apiEndpoint, { projectId }),
        data,
      )

      if (!result.ok) {
        const errData = result.data as { error?: string }
        error(`Failed: ${errData.error || `HTTP ${result.status}`}`)
        process.exit(1)
      }

      if (jsonMode) {
        console.log(renderJson(result.data))
      } else {
        success('\nCreated successfully!')
        // Show the ID of the created resource
        const created = result.data as Record<string, unknown>
        const resource = (created.session ?? created.issue ?? created.contact ?? created.company ?? created.scope ?? created) as Record<string, unknown>
        if (resource.id) {
          console.log(`ID: ${resource.id}`)
        }
      }
    } catch (err) {
      error(`Failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
      process.exit(1)
    }
  })
