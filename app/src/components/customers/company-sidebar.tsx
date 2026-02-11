'use client'

import { useState, useCallback } from 'react'
import { Spinner, CollapsibleSection, Dialog, Button } from '@/components/ui'
import { useCompanyDetail } from '@/hooks/use-companies'
import type { CompanyStage, UpdateCompanyInput } from '@/types/customer'

const STAGE_OPTIONS: { value: CompanyStage; label: string }[] = [
  { value: 'prospect', label: 'Prospect' },
  { value: 'onboarding', label: 'Onboarding' },
  { value: 'active', label: 'Active' },
  { value: 'churned', label: 'Churned' },
  { value: 'expansion', label: 'Expansion' },
]

const STAGE_COLORS: Record<CompanyStage, string> = {
  prospect: 'var(--text-tertiary)',
  onboarding: 'var(--accent-info)',
  active: 'var(--accent-success)',
  churned: 'var(--accent-danger)',
  expansion: 'var(--accent-warning)',
}

const COMPANY_FIELD_MAP: Record<string, keyof UpdateCompanyInput> = {
  industry: 'industry',
  planTier: 'plan_tier',
  country: 'country',
  productUsed: 'product_used',
  employeeCount: 'employee_count',
  notes: 'notes',
  renewalDate: 'renewal_date',
  arr: 'arr',
  healthScore: 'health_score',
}

interface CompanySidebarProps {
  projectId: string
  companyId: string
  onClose: () => void
  onCompanyUpdated?: () => void
}

export function CompanySidebar({
  projectId,
  companyId,
  onClose,
  onCompanyUpdated,
}: CompanySidebarProps) {
  const { company, isLoading, updateCompany, archiveCompany } = useCompanyDetail({ projectId, companyId })
  const [isArchiving, setIsArchiving] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [showStageDropdown, setShowStageDropdown] = useState(false)
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false)

  const handleArchiveToggle = useCallback(async () => {
    if (!company) return
    setIsArchiving(true)
    try {
      const success = await archiveCompany(!company.is_archived)
      if (success) {
        onCompanyUpdated?.()
      }
    } catch (err) {
      console.error('[company-sidebar] archive toggle failed:', err)
    } finally {
      setIsArchiving(false)
    }
  }, [company, archiveCompany, onCompanyUpdated])

  const handleStageSelect = useCallback(async (newStage: CompanyStage) => {
    setIsSaving(true)
    await updateCompany({ stage: newStage })
    setIsSaving(false)
    onCompanyUpdated?.()
    setShowStageDropdown(false)
  }, [updateCompany, onCompanyUpdated])

  const handleFieldSave = useCallback(async (fieldKey: string, newValue: string): Promise<boolean> => {
    const dbColumn = COMPANY_FIELD_MAP[fieldKey]
    if (!dbColumn) return false

    let parsed: unknown = newValue || null
    if (dbColumn === 'employee_count' || dbColumn === 'arr' || dbColumn === 'health_score') {
      parsed = newValue ? Number(newValue) : null
    }

    const success = await updateCompany({ [dbColumn]: parsed } as UpdateCompanyInput)
    if (success) onCompanyUpdated?.()
    return success
  }, [updateCompany, onCompanyUpdated])

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} aria-hidden="true" />
      <aside className="fixed right-0 top-0 z-50 flex h-full w-full max-w-2xl flex-col border-l-2 border-[color:var(--border-subtle)] bg-[color:var(--background)] shadow-xl">
        {/* Header */}
        <div className="shrink-0 border-b-2 border-[color:var(--border-subtle)] p-4">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs uppercase tracking-wide text-[color:var(--text-secondary)]">
              Company Details
            </span>
            <button
              type="button"
              onClick={onClose}
              className="rounded-[4px] p-2 text-[color:var(--text-secondary)] transition hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--foreground)]"
              aria-label="Close sidebar"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {company && (
            <>
              <div className="mt-1">
                <h3 className="text-lg font-semibold text-[color:var(--foreground)]">{company.name}</h3>
                <p className="text-sm text-[color:var(--text-secondary)]">{company.domain}</p>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                {/* Stage dropdown */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowStageDropdown(!showStageDropdown)}
                    className="inline-flex items-center gap-1.5 rounded-[4px] px-2 py-1 text-xs text-[color:var(--text-secondary)] transition hover:bg-[color:var(--surface-hover)]"
                  >
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: STAGE_COLORS[company.stage] }}
                    />
                    <span>{STAGE_OPTIONS.find((o) => o.value === company.stage)?.label ?? company.stage}</span>
                  </button>
                  {showStageDropdown && (
                    <div className="absolute left-0 top-full z-50 mt-1 min-w-[200px] rounded-[4px] border border-[color:var(--border-subtle)] bg-[color:var(--background)] p-3 shadow-lg">
                      <span className="mb-2 block font-mono text-xs uppercase tracking-wide text-[color:var(--text-secondary)]">Stage</span>
                      <div className="flex flex-col gap-0.5">
                        {STAGE_OPTIONS.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => void handleStageSelect(option.value)}
                            disabled={isSaving}
                            className="flex items-center gap-2 rounded-[4px] px-2 py-1.5 text-left text-sm transition hover:bg-[color:var(--surface-hover)] disabled:opacity-50"
                          >
                            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: STAGE_COLORS[option.value] }} />
                            <span className={company.stage === option.value ? 'font-medium text-[color:var(--foreground)]' : 'text-[color:var(--text-secondary)]'}>
                              {option.label}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Archive */}
                <button
                  type="button"
                  onClick={() => company.is_archived ? void handleArchiveToggle() : setShowArchiveConfirm(true)}
                  disabled={isArchiving}
                  className={`inline-flex items-center gap-1.5 rounded-[4px] px-2 py-1 text-xs transition hover:bg-[color:var(--surface-hover)] disabled:opacity-50 ${
                    company.is_archived ? 'text-[color:var(--accent-primary)]' : 'text-[color:var(--text-secondary)]'
                  }`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="4" width="20" height="5" rx="2" />
                    <path d="M4 9v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9" />
                    <path d="M10 13h4" />
                  </svg>
                  <span>{isArchiving ? 'Updating...' : company.is_archived ? 'Unarchive' : 'Archive'}</span>
                </button>
              </div>
            </>
          )}
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex flex-1 items-center justify-center"><Spinner /></div>
        ) : company ? (
          <div className="flex-1 overflow-y-auto">
            {/* Key Metrics */}
            <div className="border-b-2 border-[color:var(--border-subtle)] p-4">
              <CollapsibleSection title="Key Metrics" variant="flat" defaultExpanded>
                <div className="flex items-center gap-4 rounded-[4px] border border-[color:var(--border-subtle)] bg-[color:var(--surface)] p-3">
                  <div className="flex-1 text-center">
                    <p className="font-mono text-2xl font-bold text-[color:var(--foreground)]">
                      {company.arr ? `$${formatNumber(company.arr)}` : '-'}
                    </p>
                    <p className="font-mono text-xs uppercase text-[color:var(--text-secondary)]">ARR</p>
                  </div>
                  <div className="h-8 w-px bg-[color:var(--border-subtle)]" />
                  <div className="flex-1 text-center">
                    <p className="font-mono text-2xl font-bold text-[color:var(--foreground)]">
                      {company.health_score ?? '-'}
                    </p>
                    <p className="font-mono text-xs uppercase text-[color:var(--text-secondary)]">Health</p>
                  </div>
                  <div className="h-8 w-px bg-[color:var(--border-subtle)]" />
                  <div className="flex-1 text-center">
                    <p className="font-mono text-2xl font-bold text-[color:var(--foreground)]">
                      {company.contact_count}
                    </p>
                    <p className="font-mono text-xs uppercase text-[color:var(--text-secondary)]">Contacts</p>
                  </div>
                </div>
              </CollapsibleSection>
            </div>

            {/* Contacts */}
            <div className="border-b-2 border-[color:var(--border-subtle)] p-4">
              <CollapsibleSection title={`Contacts (${company.contacts?.length ?? 0})`} variant="flat" defaultExpanded>
                {company.contacts && company.contacts.length > 0 ? (
                  <div className="flex flex-col gap-1 mt-1">
                    {company.contacts.map((contact) => (
                      <div key={contact.id} className="flex items-center gap-2 rounded-[4px] px-1 py-1 text-sm">
                        <span className="min-w-0 flex-1 truncate text-[color:var(--foreground)]">{contact.name}</span>
                        <span className="shrink-0 text-xs text-[color:var(--text-tertiary)]">{contact.email}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-1 text-sm text-[color:var(--text-secondary)]">No contacts linked</p>
                )}
              </CollapsibleSection>
            </div>

            {/* Details */}
            <div className="border-b-2 border-[color:var(--border-subtle)] p-4">
              <CollapsibleSection title="Details" variant="flat" defaultExpanded={false}>
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <EditableDetailField label="Industry" value={company.industry} fieldKey="industry" onSave={handleFieldSave} />
                  <EditableDetailField label="Plan Tier" value={company.plan_tier} fieldKey="planTier" onSave={handleFieldSave} />
                  <EditableDetailField label="Employee Count" value={company.employee_count?.toString()} fieldKey="employeeCount" onSave={handleFieldSave} type="number" />
                  <EditableDetailField label="Country" value={company.country} fieldKey="country" onSave={handleFieldSave} />
                  <EditableDetailField label="Product Used" value={company.product_used} fieldKey="productUsed" onSave={handleFieldSave} />
                  <EditableDetailField
                    label="Renewal Date"
                    value={company.renewal_date ? new Date(company.renewal_date).toLocaleDateString() : null}
                    fieldKey="renewalDate"
                    onSave={handleFieldSave}
                    type="date"
                  />
                  <EditableDetailField label="ARR" value={company.arr?.toString()} fieldKey="arr" onSave={handleFieldSave} type="number" />
                  <EditableDetailField label="Health Score" value={company.health_score?.toString()} fieldKey="healthScore" onSave={handleFieldSave} type="number" />
                  <DetailField label="Created" value={formatDateTime(company.created_at)} />
                  <DetailField label="Updated" value={formatDateTime(company.updated_at)} />
                </div>

                {/* Notes */}
                <div className="mt-4">
                  <EditableDetailField
                    label="Notes"
                    value={company.notes}
                    fieldKey="notes"
                    onSave={handleFieldSave}
                    type="textarea"
                  />
                </div>
              </CollapsibleSection>
            </div>
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-[color:var(--text-secondary)]">Company not found</p>
          </div>
        )}
      </aside>

      {/* Archive confirmation dialog */}
      <Dialog open={showArchiveConfirm} onClose={() => setShowArchiveConfirm(false)} title="Archive Company" size="md">
        <p className="text-sm text-[color:var(--text-secondary)]">
          Are you sure you want to archive <strong>{company?.name}</strong>? Archived companies are hidden from the default view.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" size="md" onClick={() => setShowArchiveConfirm(false)}>Cancel</Button>
          <Button variant="danger" size="md" onClick={() => { setShowArchiveConfirm(false); void handleArchiveToggle() }}>Archive</Button>
        </div>
      </Dialog>
    </>
  )
}

function DetailField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="font-mono uppercase tracking-wide text-[color:var(--text-secondary)]">{label}</label>
      <p className="text-[color:var(--foreground)]">{value || '-'}</p>
    </div>
  )
}

function EditableDetailField({
  label,
  value,
  fieldKey,
  onSave,
  type = 'text',
}: {
  label: string
  value: string | null | undefined
  fieldKey: string
  onSave: (fieldKey: string, newValue: string) => Promise<boolean>
  type?: 'text' | 'number' | 'date' | 'textarea'
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(value ?? '')
  const [isSaving, setIsSaving] = useState(false)

  const handleStartEdit = () => {
    setEditValue(value ?? '')
    setIsEditing(true)
  }

  const handleCancel = () => {
    setEditValue(value ?? '')
    setIsEditing(false)
  }

  const handleSave = async () => {
    setIsSaving(true)
    const success = await onSave(fieldKey, editValue)
    setIsSaving(false)
    if (success) setIsEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && type !== 'textarea') void handleSave()
    if (e.key === 'Escape') handleCancel()
  }

  if (isEditing) {
    return (
      <div className="flex flex-col gap-1">
        <label className="font-mono uppercase tracking-wide text-[color:var(--text-secondary)]">{label}</label>
        <div className="flex items-center gap-1">
          {type === 'textarea' ? (
            <textarea
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
              rows={3}
              className="flex-1 rounded-[4px] border border-[color:var(--border-subtle)] bg-transparent px-2 py-1 text-xs text-[color:var(--foreground)] outline-none focus:border-[color:var(--accent-selected)]"
            />
          ) : (
            <input
              type={type}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
              className="flex-1 rounded-[4px] border border-[color:var(--border-subtle)] bg-transparent px-2 py-1 text-xs text-[color:var(--foreground)] outline-none focus:border-[color:var(--accent-selected)]"
            />
          )}
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={isSaving}
            className="rounded-[4px] p-1 text-[color:var(--accent-success)] transition hover:bg-[color:var(--surface-hover)] disabled:opacity-50"
            aria-label="Save"
          >
            {isSaving ? (
              <svg className="animate-spin" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="12" /></svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
            )}
          </button>
          <button
            type="button"
            onClick={handleCancel}
            className="rounded-[4px] p-1 text-[color:var(--accent-danger)] transition hover:bg-[color:var(--surface-hover)]"
            aria-label="Cancel"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="group flex flex-col gap-1">
      <label className="font-mono uppercase tracking-wide text-[color:var(--text-secondary)]">{label}</label>
      <div className="flex items-center gap-1">
        <p className="flex-1 text-[color:var(--foreground)]">{value || '-'}</p>
        <button
          type="button"
          onClick={handleStartEdit}
          className="rounded-[4px] p-1 text-[color:var(--text-secondary)] opacity-0 transition hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--foreground)] group-hover:opacity-100"
          aria-label={`Edit ${label}`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
        </button>
      </div>
    </div>
  )
}

function formatNumber(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`
  if (num >= 1_000) return `${(num / 1_000).toFixed(0)}K`
  return num.toFixed(0)
}

function formatDateTime(dateString: string): string {
  return new Date(dateString).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}
