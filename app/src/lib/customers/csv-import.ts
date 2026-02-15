/**
 * CSV Import Service for Companies and Contacts
 *
 * Handles parsing CSV content, suggesting column mappings,
 * and importing rows with upsert behavior.
 */

import Papa from 'papaparse'
import type { SupabaseClient } from '@supabase/supabase-js'
import { COMPANY_STAGES } from '@/types/customer'
import type {
  CustomerEntityType,
  CustomFieldDefinition,
  CSVImportMapping,
  CSVImportResult,
} from '@/types/customer'

// ============================================================================
// CSV Parsing
// ============================================================================

/**
 * Parse raw CSV text into headers and row objects.
 */
export function parseCSVContent(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
    transform: (value) => value.trim(),
  })

  const headers = result.meta.fields ?? []
  if (headers.length === 0) {
    return { headers: [], rows: [] }
  }

  // Ensure every row has all header keys (PapaParse omits missing trailing columns)
  const rows = result.data.map((row) => {
    const filled: Record<string, string> = {}
    for (const h of headers) {
      filled[h] = row[h] ?? ''
    }
    return filled
  })

  return { headers, rows }
}

// ============================================================================
// Column Mapping Suggestions
// ============================================================================

const COMPANY_FIELD_ALIASES: Record<string, string[]> = {
  name: ['company', 'company_name', 'account', 'account_name', 'organization'],
  domain: ['website', 'url', 'company_url', 'company_domain', 'web'],
  arr: ['annual_revenue', 'revenue', 'mrr', 'annual_recurring_revenue', 'contract_value'],
  stage: ['lifecycle', 'lifecycle_stage', 'status', 'customer_stage', 'phase'],
  product_used: ['product', 'products', 'plan', 'subscription'],
  industry: ['sector', 'vertical', 'business_type'],
  employee_count: ['employees', 'size', 'company_size', 'headcount', 'team_size'],
  plan_tier: ['plan', 'tier', 'subscription_level', 'pricing_plan'],
  renewal_date: ['renewal', 'contract_end', 'expiry', 'contract_renewal'],
  health_score: ['health', 'score', 'customer_health', 'satisfaction'],
  country: ['location', 'region', 'geography', 'geo'],
  notes: ['note', 'comments', 'description'],
}

const CONTACT_FIELD_ALIASES: Record<string, string[]> = {
  name: ['contact_name', 'full_name', 'first_name', 'person'],
  email: ['email_address', 'mail', 'contact_email'],
  role: ['job_role', 'department', 'function'],
  title: ['job_title', 'position', 'designation'],
  phone: ['phone_number', 'telephone', 'mobile', 'cell'],
  company_url: ['website', 'company_website', 'linkedin'],
  is_champion: ['champion', 'advocate', 'promoter'],
  notes: ['note', 'comments', 'description'],
  company_name: ['company', 'account', 'account_name', 'organization', 'org'],
  company_domain: ['domain', 'company_website', 'website'],
}

/**
 * Suggest column mappings based on header names.
 */
export function suggestMappings(
  headers: string[],
  entityType: CustomerEntityType,
  customFields: CustomFieldDefinition[] = []
): CSVImportMapping[] {
  const aliases = entityType === 'company' ? COMPANY_FIELD_ALIASES : CONTACT_FIELD_ALIASES

  return headers.map((header) => {
    const normalized = header.toLowerCase().replace(/[\s-]+/g, '_')

    // Check direct field name match
    if (aliases[normalized]) {
      return { csvColumn: header, targetField: normalized, sampleValues: [] }
    }

    // Check alias match
    for (const [field, fieldAliases] of Object.entries(aliases)) {
      if (fieldAliases.includes(normalized)) {
        return { csvColumn: header, targetField: field, sampleValues: [] }
      }
    }

    // Check custom field match
    for (const cf of customFields) {
      const cfNormalized = cf.field_key.toLowerCase().replace(/[\s-]+/g, '_')
      if (normalized === cfNormalized || normalized === cf.field_label.toLowerCase().replace(/[\s-]+/g, '_')) {
        return { csvColumn: header, targetField: `custom:${cf.field_key}`, sampleValues: [] }
      }
    }

    return { csvColumn: header, targetField: null, sampleValues: [] }
  })
}

// ============================================================================
// Import Execution
// ============================================================================

/**
 * Validate and import rows into companies or contacts.
 * Uses upsert behavior: companies by domain, contacts by email.
 */
export async function validateAndImportRows(
  projectId: string,
  entityType: CustomerEntityType,
  rows: Record<string, string>[],
  mappings: CSVImportMapping[],
  supabase: SupabaseClient,
  options: { createMissingCompanies?: boolean } = {}
): Promise<CSVImportResult> {
  const result: CSVImportResult = {
    created: 0,
    updated: 0,
    errors: [],
    total: rows.length,
  }

  // Build field mapping: targetField -> csvColumn
  const fieldMap = new Map<string, string>()
  for (const mapping of mappings) {
    if (mapping.targetField) {
      fieldMap.set(mapping.targetField, mapping.csvColumn)
    }
  }

  // Batch-fetch existing records to avoid per-row SELECT queries
  const existingMap = new Map<string, string>() // key (domain or email) -> id
  if (entityType === 'company') {
    const domainCol = fieldMap.get('domain')
    if (domainCol) {
      const domains = rows.map((r) => (r[domainCol] ?? '').trim()).filter(Boolean)
      if (domains.length > 0) {
        const { data } = await supabase
          .from('companies')
          .select('id, domain')
          .eq('project_id', projectId)
          .in('domain', domains)
        for (const row of data ?? []) {
          existingMap.set(row.domain, row.id)
        }
      }
    }
  } else {
    const emailCol = fieldMap.get('email')
    if (emailCol) {
      const emails = rows.map((r) => (r[emailCol] ?? '').trim()).filter(Boolean)
      if (emails.length > 0) {
        const { data } = await supabase
          .from('contacts')
          .select('id, email')
          .eq('project_id', projectId)
          .in('email', emails)
        for (const row of data ?? []) {
          existingMap.set(row.email, row.id)
        }
      }
    }
  }

  // For contact imports, batch-fetch existing companies by domain for auto-linking
  const companyMap = new Map<string, string>() // domain -> company id
  if (entityType === 'contact') {
    const companyDomainCol = fieldMap.get('company_domain')
    if (companyDomainCol) {
      const domains = rows
        .map((r) => (r[companyDomainCol] ?? '').trim().toLowerCase())
        .filter(Boolean)
      if (domains.length > 0) {
        const uniqueDomains = [...new Set(domains)]
        const { data } = await supabase
          .from('companies')
          .select('id, domain')
          .eq('project_id', projectId)
          .in('domain', uniqueDomains)
        for (const row of data ?? []) {
          companyMap.set(row.domain, row.id)
        }
      }
    }
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    try {
      if (entityType === 'company') {
        await importCompanyRow(supabase, projectId, row, fieldMap, result, i, existingMap)
      } else {
        await importContactRow(supabase, projectId, row, fieldMap, result, i, existingMap, companyMap, options.createMissingCompanies ?? false)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      result.errors.push({ row: i + 2, message }) // +2 for 1-indexed + header row
    }
  }

  return result
}

async function importCompanyRow(
  supabase: SupabaseClient,
  projectId: string,
  row: Record<string, string>,
  fieldMap: Map<string, string>,
  result: CSVImportResult,
  rowIndex: number,
  existingMap: Map<string, string>
) {
  const getValue = (field: string) => {
    const col = fieldMap.get(field)
    return col ? (row[col] ?? '').trim() : ''
  }

  const domain = getValue('domain')
  if (!domain) {
    result.errors.push({ row: rowIndex + 2, message: 'Missing required field: domain' })
    return
  }

  const name = getValue('name') || domain

  // Validate stage if provided
  const stage = getValue('stage')
  if (stage) {
    const validStages = COMPANY_STAGES as readonly string[]
    if (!validStages.includes(stage.toLowerCase())) {
      result.errors.push({ row: rowIndex + 2, message: `Invalid stage "${stage}". Must be one of: ${COMPANY_STAGES.join(', ')}` })
      return
    }
  }

  // Build custom fields
  const customFields: Record<string, unknown> = {}
  for (const [field, col] of fieldMap.entries()) {
    if (field.startsWith('custom:')) {
      const key = field.slice(7)
      customFields[key] = row[col] ?? ''
    }
  }

  const companyData: Record<string, unknown> = {
    project_id: projectId,
    name,
    domain,
    custom_fields: customFields,
  }

  const arrStr = getValue('arr')
  if (arrStr) companyData.arr = parseFloat(arrStr) || null
  if (stage) companyData.stage = stage.toLowerCase()
  const productUsed = getValue('product_used')
  if (productUsed) companyData.product_used = productUsed
  const industry = getValue('industry')
  if (industry) companyData.industry = industry
  const empCount = getValue('employee_count')
  if (empCount) companyData.employee_count = parseInt(empCount, 10) || null
  const planTier = getValue('plan_tier')
  if (planTier) companyData.plan_tier = planTier
  const renewalDate = getValue('renewal_date')
  if (renewalDate) companyData.renewal_date = renewalDate
  const healthScore = getValue('health_score')
  if (healthScore) companyData.health_score = parseFloat(healthScore) || null
  const country = getValue('country')
  if (country) companyData.country = country
  const notes = getValue('notes')
  if (notes) companyData.notes = notes

  // Upsert by domain using pre-fetched existing map
  const existingId = existingMap.get(domain)

  if (existingId) {
    const { error } = await supabase
      .from('companies')
      .update(companyData)
      .eq('id', existingId)
    if (error) throw new Error(error.message)
    result.updated++
  } else {
    const { error } = await supabase
      .from('companies')
      .insert(companyData)
    if (error) throw new Error(error.message)
    result.created++
  }
}

async function importContactRow(
  supabase: SupabaseClient,
  projectId: string,
  row: Record<string, string>,
  fieldMap: Map<string, string>,
  result: CSVImportResult,
  rowIndex: number,
  existingMap: Map<string, string>,
  companyMap: Map<string, string>,
  createMissingCompanies: boolean
) {
  const getValue = (field: string) => {
    const col = fieldMap.get(field)
    return col ? (row[col] ?? '').trim() : ''
  }

  const email = getValue('email')
  if (!email) {
    result.errors.push({ row: rowIndex + 2, message: 'Missing required field: email' })
    return
  }

  const name = getValue('name') || email

  // Build custom fields
  const customFields: Record<string, unknown> = {}
  for (const [field, col] of fieldMap.entries()) {
    if (field.startsWith('custom:')) {
      const key = field.slice(7)
      customFields[key] = row[col] ?? ''
    }
  }

  const contactData: Record<string, unknown> = {
    project_id: projectId,
    name,
    email,
    custom_fields: customFields,
  }

  // Auto-resolve company by domain
  const companyDomain = getValue('company_domain').toLowerCase()
  const companyName = getValue('company_name')
  if (companyDomain) {
    const existingCompanyId = companyMap.get(companyDomain)
    if (existingCompanyId) {
      contactData.company_id = existingCompanyId
    } else if (createMissingCompanies) {
      // Create the company and cache its ID for subsequent rows
      const newCompanyData = {
        project_id: projectId,
        name: companyName || companyDomain,
        domain: companyDomain,
      }
      const { data: newCompany, error: companyError } = await supabase
        .from('companies')
        .insert(newCompanyData)
        .select('id')
        .single()
      if (!companyError && newCompany) {
        companyMap.set(companyDomain, newCompany.id)
        contactData.company_id = newCompany.id
      }
    }
  }

  const role = getValue('role')
  if (role) contactData.role = role
  const contactTitle = getValue('title')
  if (contactTitle) contactData.title = contactTitle
  const phone = getValue('phone')
  if (phone) contactData.phone = phone
  const companyUrl = getValue('company_url')
  if (companyUrl) contactData.company_url = companyUrl
  const isChampion = getValue('is_champion')
  if (isChampion) contactData.is_champion = ['true', 'yes', '1'].includes(isChampion.toLowerCase())
  const notes = getValue('notes')
  if (notes) contactData.notes = notes

  // Upsert by email using pre-fetched existing map
  const existingId = existingMap.get(email)

  if (existingId) {
    const { error } = await supabase
      .from('contacts')
      .update(contactData)
      .eq('id', existingId)
    if (error) throw new Error(error.message)
    result.updated++
  } else {
    const { error } = await supabase
      .from('contacts')
      .insert(contactData)
    if (error) throw new Error(error.message)
    result.created++
  }
}
