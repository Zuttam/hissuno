'use client'

import { useState, useCallback, useEffect } from 'react'
import {
  Dialog,
  Button,
  Select,
  Input,
  Textarea,
  Tabs,
  TabsList,
  Tab,
  TabsPanel,
  FileDropZone,
} from '@/components/ui'
import { parseCSVContent, suggestMappings } from '@/lib/customers/csv-import'
import type {
  CustomerEntityType,
  CSVImportMapping,
  CSVImportResult,
  CreateCompanyInput,
  CreateContactInput,
  CompanyStage,
  CompanyWithContacts,
} from '@/types/customer'
import { COMPANY_STAGES } from '@/types/customer'

interface AddDataDialogProps {
  open: boolean
  onClose: () => void
  projectId: string
  onDataAdded: () => void
  defaultEntityType?: 'company' | 'contact'
  onCreateCompany: (input: CreateCompanyInput) => Promise<unknown>
  onCreateContact: (input: CreateContactInput) => Promise<unknown>
}

const STAGE_LABELS: Record<CompanyStage, string> = {
  prospect: 'Prospect',
  onboarding: 'Onboarding',
  active: 'Active',
  churned: 'Churned',
  expansion: 'Expansion',
}

type MethodTab = 'csv' | 'manual'
type CSVStep = 'upload' | 'map' | 'preview' | 'result'

export function AddDataDialog({
  open,
  onClose,
  projectId,
  onDataAdded,
  defaultEntityType = 'company',
  onCreateCompany,
  onCreateContact,
}: AddDataDialogProps) {
  // Shared state
  const [entityType, setEntityType] = useState<CustomerEntityType>(defaultEntityType)
  const [methodTab, setMethodTab] = useState<MethodTab>('csv')
  const [error, setError] = useState<string | null>(null)

  // CSV state
  const [csvStep, setCsvStep] = useState<CSVStep>('upload')
  const [rows, setRows] = useState<Record<string, string>[]>([])
  const [mappings, setMappings] = useState<CSVImportMapping[]>([])
  const [isImporting, setIsImporting] = useState(false)
  const [csvResult, setCsvResult] = useState<CSVImportResult | null>(null)
  const [createMissingCompanies, setCreateMissingCompanies] = useState(false)

  // Manual form state - Company
  const [companyName, setCompanyName] = useState('')
  const [companyDomain, setCompanyDomain] = useState('')
  const [companyArr, setCompanyArr] = useState('')
  const [companyStage, setCompanyStage] = useState<CompanyStage>('prospect')
  const [companyIndustry, setCompanyIndustry] = useState('')
  const [companyPlanTier, setCompanyPlanTier] = useState('')
  const [companyCountry, setCompanyCountry] = useState('')
  const [companyNotes, setCompanyNotes] = useState('')

  // Manual form state - Contact
  const [contactName, setContactName] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [contactCompanyId, setContactCompanyId] = useState('')
  const [contactTitle, setContactTitle] = useState('')
  const [contactRole, setContactRole] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [contactIsChampion, setContactIsChampion] = useState(false)
  const [contactNotes, setContactNotes] = useState('')

  // Companies dropdown for contact form
  const [companies, setCompanies] = useState<CompanyWithContacts[]>([])

  const [isSubmitting, setIsSubmitting] = useState(false)

  // Sync defaultEntityType when dialog opens
  useEffect(() => {
    if (open) {
      setEntityType(defaultEntityType)
    }
  }, [open, defaultEntityType])

  // Fetch companies for contact form dropdown
  useEffect(() => {
    if (!open || !projectId) return

    const fetchCompanies = async () => {
      try {
        const response = await fetch(`/api/projects/${projectId}/customers/companies?limit=100`)
        if (response.ok) {
          const data = await response.json()
          setCompanies(data.companies ?? [])
        }
      } catch {
        console.error('[AddDataDialog] Failed to fetch companies')
      }
    }

    void fetchCompanies()
  }, [projectId, open])

  const csvTargetFields =
    entityType === 'company'
      ? ['name', 'domain', 'arr', 'stage', 'product_used', 'industry', 'employee_count', 'plan_tier', 'renewal_date', 'health_score', 'country', 'notes']
      : ['name', 'email', 'role', 'title', 'phone', 'company_url', 'is_champion', 'notes', 'company_name', 'company_domain']

  // Reset all state
  const resetAll = useCallback(() => {
    setError(null)
    setCsvStep('upload')
    setRows([])
    setMappings([])
    setCsvResult(null)
    setIsImporting(false)
    setCreateMissingCompanies(false)
    setCompanyName('')
    setCompanyDomain('')
    setCompanyArr('')
    setCompanyStage('prospect')
    setCompanyIndustry('')
    setCompanyPlanTier('')
    setCompanyCountry('')
    setCompanyNotes('')
    setContactName('')
    setContactEmail('')
    setContactCompanyId('')
    setContactTitle('')
    setContactRole('')
    setContactPhone('')
    setContactIsChampion(false)
    setContactNotes('')
    setIsSubmitting(false)
  }, [])

  // Reset when entity type changes
  const handleEntityTypeChange = useCallback(
    (newType: CustomerEntityType) => {
      setEntityType(newType)
      resetAll()
    },
    [resetAll]
  )

  const handleClose = useCallback(() => {
    resetAll()
    onClose()
  }, [resetAll, onClose])

  // ── CSV handlers ──

  const handleFileSelect = useCallback(
    async (selectedFile: File) => {
      setError(null)

      const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
      if (selectedFile.size > MAX_FILE_SIZE) {
        setError(`File too large. Maximum size is 5MB (got ${(selectedFile.size / 1024 / 1024).toFixed(1)}MB).`)
        return
      }

      try {
        const text = await selectedFile.text()
        const parsed = parseCSVContent(text)

        if (parsed.headers.length === 0) {
          setError('Could not parse CSV headers.')
          return
        }

        const MAX_ROW_COUNT = 500
        if (parsed.rows.length > MAX_ROW_COUNT) {
          setError(`Too many rows. Maximum is ${MAX_ROW_COUNT.toLocaleString()} rows (got ${parsed.rows.length.toLocaleString()}).`)
          return
        }

        setRows(parsed.rows)

        const suggested = suggestMappings(parsed.headers, entityType)
        for (const mapping of suggested) {
          mapping.sampleValues = parsed.rows.slice(0, 3).map((r) => r[mapping.csvColumn] ?? '')
        }
        setMappings(suggested)
        setCsvStep('map')
      } catch {
        setError('Failed to parse CSV file.')
      }
    },
    [entityType]
  )

  const handleMappingChange = useCallback((csvColumn: string, targetField: string | null) => {
    setMappings((prev) =>
      prev.map((m) => (m.csvColumn === csvColumn ? { ...m, targetField } : m))
    )
  }, [])

  const handleImport = useCallback(async () => {
    if (rows.length === 0) return

    setIsImporting(true)
    setError(null)

    try {
      const response = await fetch(`/api/projects/${projectId}/customers/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entity_type: entityType,
          rows,
          mappings,
          create_missing_companies: createMissingCompanies,
        }),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(typeof payload?.error === 'string' ? payload.error : 'Import failed.')
      }

      const payload = await response.json()
      setCsvResult(payload.result)
      setCsvStep('result')
      onDataAdded()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed.')
    } finally {
      setIsImporting(false)
    }
  }, [rows, entityType, mappings, projectId, onDataAdded, createMissingCompanies])

  // ── Manual form handlers ──

  const handleCompanySubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!companyName.trim()) {
        setError('Please enter a company name.')
        return
      }
      if (!companyDomain.trim()) {
        setError('Please enter a domain.')
        return
      }

      setIsSubmitting(true)
      setError(null)

      try {
        const input: CreateCompanyInput = {
          project_id: projectId,
          name: companyName.trim(),
          domain: companyDomain.trim().toLowerCase(),
          arr: companyArr ? parseFloat(companyArr) : null,
          stage: companyStage,
          industry: companyIndustry.trim() || null,
          plan_tier: companyPlanTier.trim() || null,
          country: companyCountry.trim() || null,
          notes: companyNotes.trim() || null,
        }

        const result = await onCreateCompany(input)
        if (result) {
          onDataAdded()
          handleClose()
        } else {
          setError('Failed to create company. Please try again.')
        }
      } catch {
        setError('An unexpected error occurred.')
      } finally {
        setIsSubmitting(false)
      }
    },
    [projectId, companyName, companyDomain, companyArr, companyStage, companyIndustry, companyPlanTier, companyCountry, companyNotes, onCreateCompany, onDataAdded, handleClose]
  )

  const handleContactSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!contactName.trim()) {
        setError('Please enter a name.')
        return
      }
      if (!contactEmail.trim()) {
        setError('Please enter an email.')
        return
      }

      setIsSubmitting(true)
      setError(null)

      try {
        const input: CreateContactInput = {
          project_id: projectId,
          name: contactName.trim(),
          email: contactEmail.trim().toLowerCase(),
          company_id: contactCompanyId || null,
          role: contactRole.trim() || null,
          title: contactTitle.trim() || null,
          phone: contactPhone.trim() || null,
          is_champion: contactIsChampion,
          notes: contactNotes.trim() || null,
        }

        const result = await onCreateContact(input)
        if (result) {
          onDataAdded()
          handleClose()
        } else {
          setError('Failed to create contact. Please try again.')
        }
      } catch {
        setError('An unexpected error occurred.')
      } finally {
        setIsSubmitting(false)
      }
    },
    [projectId, contactName, contactEmail, contactCompanyId, contactRole, contactTitle, contactPhone, contactIsChampion, contactNotes, onCreateContact, onDataAdded, handleClose]
  )

  // ── Required fields info ──

  const requiredFieldsInfo =
    entityType === 'company'
      ? { required: 'name, domain', optional: 'arr, stage, industry, plan_tier, country, notes' }
      : { required: 'name, email', optional: 'role, title, phone, company_url, is_champion, notes' }

  return (
    <Dialog open={open} onClose={handleClose} title="Add Customers" size="xl">
      <div className="flex flex-col gap-4">
        {/* Entity type selector */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-[color:var(--text-secondary)]">Entity type</label>
          <Select
            value={entityType}
            onChange={(e) => handleEntityTypeChange(e.target.value as CustomerEntityType)}
          >
            <option value="company">Companies</option>
            <option value="contact">Contacts</option>
          </Select>
        </div>

        {/* Error banner */}
        {error && (
          <div className="rounded-[4px] bg-red-500/10 px-3 py-2 text-xs text-red-600">{error}</div>
        )}

        {/* Method tabs */}
        <Tabs value={methodTab} onChange={(v) => setMethodTab(v as MethodTab)} className="flex-1">
          <TabsList className="px-0">
            <Tab value="csv">Upload CSV</Tab>
            <Tab value="manual">Manual Form</Tab>
          </TabsList>

          {/* ── CSV Tab ── */}
          <TabsPanel value="csv" className="px-0" forceMount>
            <div className="flex flex-col gap-4">
              {/* Required fields callout */}
              {csvStep === 'upload' && (
                <div className="rounded-[4px] bg-[color:var(--accent-info)]/10 px-3 py-2 text-xs text-[color:var(--text-secondary)]">
                  <span className="font-medium">Required:</span> {requiredFieldsInfo.required}
                  <span className="mx-2 text-[color:var(--text-tertiary)]">|</span>
                  <span className="font-medium">Optional:</span> {requiredFieldsInfo.optional}
                </div>
              )}

              {/* Step: Upload */}
              {csvStep === 'upload' && (
                <>
                  <FileDropZone
                    accept=".csv"
                    onFileSelect={handleFileSelect}
                    label="Select a CSV file"
                    description="or drag and drop here"
                  />
                  <p className="text-xs text-[color:var(--text-tertiary)]">
                    Maximum 500 rows, 5MB file size.
                  </p>
                </>
              )}

              {/* Step: Map columns */}
              {csvStep === 'map' && (
                <div className="flex flex-col gap-4">
                  <p className="text-xs text-[color:var(--text-secondary)]">
                    Map CSV columns to {entityType} fields. {rows.length} rows found.
                  </p>
                  <div className="max-h-80 overflow-y-auto rounded-[4px] border border-[color:var(--border-subtle)]">
                    <table className="w-full font-mono text-xs">
                      <thead>
                        <tr className="border-b border-[color:var(--border-subtle)]">
                          <th className="px-3 py-2 text-left text-[color:var(--text-secondary)]">CSV Column</th>
                          <th className="px-3 py-2 text-left text-[color:var(--text-secondary)]">Maps To</th>
                          <th className="px-3 py-2 text-left text-[color:var(--text-secondary)]">Sample</th>
                        </tr>
                      </thead>
                      <tbody>
                        {mappings.map((mapping) => (
                          <tr key={mapping.csvColumn} className="border-b border-[color:var(--border-subtle)]">
                            <td className="px-3 py-2 text-[color:var(--foreground)]">{mapping.csvColumn}</td>
                            <td className="px-3 py-2">
                              <Select
                                value={mapping.targetField ?? ''}
                                onChange={(e) => handleMappingChange(mapping.csvColumn, e.target.value || null)}
                                className="py-1 text-xs"
                              >
                                <option value="">-- Skip --</option>
                                {csvTargetFields.map((f) => (
                                  <option key={f} value={f}>{f}</option>
                                ))}
                              </Select>
                            </td>
                            <td className="px-3 py-2 text-[color:var(--text-tertiary)]">
                              {mapping.sampleValues.slice(0, 2).join(', ')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {entityType === 'contact' && mappings.some((m) => m.targetField === 'company_domain') && (
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="csv-create-missing-companies"
                        checked={createMissingCompanies}
                        onChange={(e) => setCreateMissingCompanies(e.target.checked)}
                        className="h-4 w-4 rounded border-[color:var(--border)] accent-[color:var(--accent-selected)]"
                      />
                      <label htmlFor="csv-create-missing-companies" className="text-xs text-[color:var(--text-secondary)]">
                        Create companies that don&apos;t exist yet
                      </label>
                    </div>
                  )}

                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" onClick={() => { setCsvStep('upload'); setRows([]); setMappings([]); }}>
                      Back
                    </Button>
                    <Button onClick={() => setCsvStep('preview')}>Preview</Button>
                  </div>
                </div>
              )}

              {/* Step: Preview */}
              {csvStep === 'preview' && (
                <div className="flex flex-col gap-4">
                  <p className="text-xs text-[color:var(--text-secondary)]">
                    Preview: {rows.length} rows will be imported. Existing records (by{' '}
                    {entityType === 'company' ? 'domain' : 'email'}) will be updated.
                  </p>
                  <div className="max-h-60 overflow-auto rounded-[4px] border border-[color:var(--border-subtle)]">
                    <table className="w-full font-mono text-xs">
                      <thead>
                        <tr className="border-b border-[color:var(--border-subtle)]">
                          <th className="px-2 py-1 text-left text-[color:var(--text-secondary)]">#</th>
                          {mappings
                            .filter((m) => m.targetField)
                            .map((m) => (
                              <th key={m.csvColumn} className="px-2 py-1 text-left text-[color:var(--text-secondary)]">
                                {m.targetField}
                              </th>
                            ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.slice(0, 10).map((row, i) => (
                          <tr key={i} className="border-b border-[color:var(--border-subtle)]">
                            <td className="px-2 py-1 text-[color:var(--text-tertiary)]">{i + 1}</td>
                            {mappings
                              .filter((m) => m.targetField)
                              .map((m) => (
                                <td key={m.csvColumn} className="px-2 py-1 text-[color:var(--foreground)]">
                                  {(row[m.csvColumn] ?? '').slice(0, 30)}
                                </td>
                              ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" onClick={() => setCsvStep('map')}>Back</Button>
                    <Button onClick={handleImport} loading={isImporting}>
                      Import {rows.length} rows
                    </Button>
                  </div>
                </div>
              )}

              {/* Step: Result */}
              {csvStep === 'result' && csvResult && (
                <div className="flex flex-col gap-4">
                  <div className="rounded-[4px] border border-[color:var(--border-subtle)] bg-[color:var(--surface)] p-4">
                    <h4 className="font-mono text-sm font-bold text-[color:var(--foreground)]">Import Complete</h4>
                    <div className="mt-2 flex gap-4 text-sm">
                      <div>
                        <span className="font-bold text-[color:var(--accent-success)]">{csvResult.created}</span>
                        <span className="text-[color:var(--text-secondary)]"> created</span>
                      </div>
                      <div>
                        <span className="font-bold text-[color:var(--accent-info)]">{csvResult.updated}</span>
                        <span className="text-[color:var(--text-secondary)]"> updated</span>
                      </div>
                      {csvResult.errors.length > 0 && (
                        <div>
                          <span className="font-bold text-[color:var(--accent-danger)]">{csvResult.errors.length}</span>
                          <span className="text-[color:var(--text-secondary)]"> errors</span>
                        </div>
                      )}
                    </div>
                    {csvResult.errors.length > 0 && (
                      <div className="mt-3 max-h-32 overflow-y-auto text-xs text-[color:var(--accent-danger)]">
                        {csvResult.errors.map((err, i) => (
                          <p key={i}>Row {err.row}: {err.message}</p>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end">
                    <Button onClick={handleClose}>Done</Button>
                  </div>
                </div>
              )}
            </div>
          </TabsPanel>

          {/* ── Manual Form Tab ── */}
          <TabsPanel value="manual" className="px-0" forceMount>
            {entityType === 'company' ? (
              <form onSubmit={handleCompanySubmit} className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-[color:var(--text-secondary)]">Name *</label>
                  <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Acme Inc" />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-[color:var(--text-secondary)]">Domain *</label>
                  <Input value={companyDomain} onChange={(e) => setCompanyDomain(e.target.value)} placeholder="acme.com" />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-[color:var(--text-secondary)]">ARR ($)</label>
                  <Input type="number" value={companyArr} onChange={(e) => setCompanyArr(e.target.value)} placeholder="50000" />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-[color:var(--text-secondary)]">Stage</label>
                  <Select value={companyStage} onChange={(e) => setCompanyStage(e.target.value as CompanyStage)}>
                    {COMPANY_STAGES.map((s) => (
                      <option key={s} value={s}>{STAGE_LABELS[s]}</option>
                    ))}
                  </Select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-[color:var(--text-secondary)]">Industry</label>
                  <Input value={companyIndustry} onChange={(e) => setCompanyIndustry(e.target.value)} placeholder="SaaS" />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-[color:var(--text-secondary)]">Plan Tier</label>
                  <Input value={companyPlanTier} onChange={(e) => setCompanyPlanTier(e.target.value)} placeholder="Enterprise" />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-[color:var(--text-secondary)]">Country</label>
                  <Input value={companyCountry} onChange={(e) => setCompanyCountry(e.target.value)} placeholder="US" />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-[color:var(--text-secondary)]">Notes</label>
                  <Textarea value={companyNotes} onChange={(e) => setCompanyNotes(e.target.value)} placeholder="Additional context..." rows={2} />
                </div>

                <div className="mt-2 flex justify-end gap-2">
                  <Button type="button" variant="ghost" onClick={handleClose} disabled={isSubmitting}>Cancel</Button>
                  <Button type="submit" loading={isSubmitting}>Create</Button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleContactSubmit} className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-[color:var(--text-secondary)]">Name *</label>
                  <Input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Jane Smith" />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-[color:var(--text-secondary)]">Email *</label>
                  <Input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="jane@acme.com" />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-[color:var(--text-secondary)]">Company</label>
                  <Select value={contactCompanyId} onChange={(e) => setContactCompanyId(e.target.value)}>
                    <option value="">None</option>
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </Select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-[color:var(--text-secondary)]">Title</label>
                  <Input value={contactTitle} onChange={(e) => setContactTitle(e.target.value)} placeholder="VP of Engineering" />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-[color:var(--text-secondary)]">Role</label>
                  <Input value={contactRole} onChange={(e) => setContactRole(e.target.value)} placeholder="Engineering" />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-[color:var(--text-secondary)]">Phone</label>
                  <Input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="+1 555-0123" />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="add-data-is-champion"
                    checked={contactIsChampion}
                    onChange={(e) => setContactIsChampion(e.target.checked)}
                    className="h-4 w-4 rounded border-[color:var(--border)] accent-[color:var(--accent-selected)]"
                  />
                  <label htmlFor="add-data-is-champion" className="text-xs font-medium text-[color:var(--text-secondary)]">
                    Champion / Internal Advocate
                  </label>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-[color:var(--text-secondary)]">Notes</label>
                  <Textarea value={contactNotes} onChange={(e) => setContactNotes(e.target.value)} placeholder="Additional context..." rows={2} />
                </div>

                <div className="mt-2 flex justify-end gap-2">
                  <Button type="button" variant="ghost" onClick={handleClose} disabled={isSubmitting}>Cancel</Button>
                  <Button type="submit" loading={isSubmitting}>Create</Button>
                </div>
              </form>
            )}
          </TabsPanel>
        </Tabs>
      </div>
    </Dialog>
  )
}
