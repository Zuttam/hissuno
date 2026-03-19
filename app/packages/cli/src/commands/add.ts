/**
 * hissuno add <type> — Interactively create a resource
 */

import { Command } from 'commander'
import { input, select, confirm } from '@inquirer/prompts'
import { requireConfig } from '../lib/config.js'
import { apiCall, resolveProjectId, buildPath } from '../lib/api.js'
import { renderJson, success, error } from '../lib/output.js'
import { resolveCustomerType } from '../lib/customer-type.js'

async function addIssue(): Promise<Record<string, unknown>> {
  const type = await select({
    message: 'Issue type:',
    choices: [
      { value: 'bug', name: 'Bug' },
      { value: 'feature_request', name: 'Feature Request' },
      { value: 'change_request', name: 'Change Request' },
    ],
  })

  const title = await input({ message: 'Title:', validate: (v) => v.length > 0 || 'Required' })
  const description = await input({ message: 'Description:', validate: (v) => v.length > 0 || 'Required' })

  const hasPriority = await confirm({ message: 'Set priority?', default: false })
  let priority: string | undefined
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

  return { type, title, description, ...(priority ? { priority } : {}) }
}

async function addContact(): Promise<Record<string, unknown>> {
  const name = await input({ message: 'Name:', validate: (v) => v.length > 0 || 'Required' })
  const email = await input({
    message: 'Email:',
    validate: (v) => (v.includes('@') ? true : 'Must be a valid email'),
  })

  const data: Record<string, unknown> = { name, email }

  const role = await input({ message: 'Role (optional):' })
  if (role) data.role = role

  const title = await input({ message: 'Title (optional):' })
  if (title) data.title = title

  const phone = await input({ message: 'Phone (optional):' })
  if (phone) data.phone = phone

  const companyId = await input({ message: 'Company ID (optional):' })
  if (companyId) data.company_id = companyId

  const isChampion = await confirm({ message: 'Is champion?', default: false })
  if (isChampion) data.is_champion = true

  return data
}

async function addCompany(): Promise<Record<string, unknown>> {
  const name = await input({ message: 'Company name:', validate: (v) => v.length > 0 || 'Required' })
  const domain = await input({
    message: 'Domain (e.g., acme.com):',
    validate: (v) => v.length > 0 || 'Required',
  })

  const data: Record<string, unknown> = { name, domain }

  const industry = await input({ message: 'Industry (optional):' })
  if (industry) data.industry = industry

  const arrStr = await input({ message: 'ARR (optional, number):' })
  if (arrStr) data.arr = Number(arrStr)

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

  const employeeCountStr = await input({ message: 'Employee count (optional, number):' })
  if (employeeCountStr) data.employee_count = Number(employeeCountStr)

  const planTier = await input({ message: 'Plan tier (optional):' })
  if (planTier) data.plan_tier = planTier

  const country = await input({ message: 'Country (optional):' })
  if (country) data.country = country

  const notes = await input({ message: 'Notes (optional):' })
  if (notes) data.notes = notes

  return data
}

async function addScope(): Promise<Record<string, unknown>> {
  const name = await input({ message: 'Name:', validate: (v) => v.length > 0 || 'Required' })

  const type = await select({
    message: 'Type:',
    choices: [
      { value: 'product_area', name: 'Product Area' },
      { value: 'initiative', name: 'Initiative' },
    ],
  })

  const description = await input({ message: 'Description (optional):' })

  const data: Record<string, unknown> = { name, type }
  if (description) data.description = description

  // Goals
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

  return data
}

async function addFeedback(): Promise<Record<string, unknown>> {
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

  const data: Record<string, unknown> = { messages }

  const name = await input({ message: 'Feedback name/title (optional):' })
  if (name) data.name = name

  const tags = await input({ message: 'Tags (comma-separated, optional):' })
  if (tags) data.tags = tags.split(',').map((t) => t.trim())

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
        data = await addIssue()
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
        data = customerType === 'companies' ? await addCompany() : await addContact()
        break
      }
      case 'feedback':
        data = await addFeedback()
        break
      case 'scopes':
        data = await addScope()
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
