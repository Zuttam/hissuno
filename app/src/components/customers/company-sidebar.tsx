'use client'

import { useState, useCallback, useEffect } from 'react'
import Link from 'next/link'
import { Spinner, CollapsibleSection, Dialog, Button, Badge } from '@/components/ui'
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
            {/* Feedback Activity */}
            <CompanyActivitySection companyId={companyId} projectId={projectId} />

            {/* Contacts */}
            <div className="border-b-2 border-[color:var(--border-subtle)] p-4">
              <CollapsibleSection title={`Contacts (${company.contacts?.length ?? 0})`} variant="flat" defaultExpanded>
                {company.contacts && company.contacts.length > 0 ? (
                  <div className="flex flex-col gap-1 mt-1">
                    {company.contacts.map((contact) => (
                      <Link
                        key={contact.id}
                        href={`/projects/${projectId}/customers/contacts/${contact.id}`}
                        className="flex items-center gap-2 rounded-[4px] px-1 py-1 text-sm transition hover:bg-[color:var(--surface-hover)]"
                      >
                        <span className="min-w-0 flex-1 truncate text-[color:var(--foreground)]">{contact.name}</span>
                        <span className="shrink-0 text-xs text-[color:var(--text-tertiary)]">{contact.email}</span>
                      </Link>
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
                  <EditableDetailField label="ARR" value={company.arr?.toString()} fieldKey="arr" onSave={handleFieldSave} type="number" displayPrefix="$" />
                  <EditableDetailField label="Health Score" value={company.health_score?.toString()} fieldKey="healthScore" onSave={handleFieldSave} type="number" />
                  <DetailField label="Created" value={formatDateTime(company.created_at)} />
                  <DetailField label="Updated" value={formatDateTime(company.updated_at)} />
                  <div className="col-span-2">
                    <EditableDetailField
                      label="Notes"
                      value={company.notes}
                      fieldKey="notes"
                      onSave={handleFieldSave}
                      type="textarea"
                    />
                  </div>
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
  displayPrefix,
}: {
  label: string
  value: string | null | undefined
  fieldKey: string
  onSave: (fieldKey: string, newValue: string) => Promise<boolean>
  type?: 'text' | 'number' | 'date' | 'textarea'
  displayPrefix?: string
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
        <p className="flex-1 text-[color:var(--foreground)]">{value ? `${displayPrefix ?? ''}${value}` : '-'}</p>
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

function formatDateTime(dateString: string): string {
  return new Date(dateString).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

function formatRelativeDate(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays === 0) {
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    if (diffHours === 0) return 'just now'
    return `${diffHours}h ago`
  }
  if (diffDays === 1) return 'yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`
  return `${Math.floor(diffDays / 30)}mo ago`
}

const SOURCE_BADGE_VARIANTS: Record<string, 'info' | 'success' | 'warning' | 'default'> = {
  widget: 'info', slack: 'warning', intercom: 'success', gong: 'default', api: 'default', manual: 'default',
}

const TYPE_BADGE_VARIANTS: Record<string, 'info' | 'danger' | 'warning' | 'default'> = {
  bug: 'danger', feature_request: 'info', change_request: 'warning',
}

const TYPE_LABELS: Record<string, string> = {
  bug: 'Bug', feature_request: 'Feature', change_request: 'Change',
}

// ============================================================================
// Company Activity Section
// ============================================================================

interface CompanyActivity {
  sessions: Array<{ id: string; name: string | null; source: string; created_at: string }>
  issues: Array<{ id: string; title: string; type: string; status: string }>
}

function CompanyActivitySection({ companyId, projectId }: { companyId: string; projectId: string }) {
  const [activity, setActivity] = useState<CompanyActivity | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function fetchActivity() {
      try {
        const res = await fetch(`/api/projects/${projectId}/customers/companies/${companyId}/activity`)
        if (res.ok) {
          const data = await res.json()
          setActivity(data)
        }
      } catch (err) {
        console.error('[company-sidebar] failed to fetch activity:', err)
      } finally {
        setIsLoading(false)
      }
    }
    void fetchActivity()
  }, [companyId, projectId])

  const sessionCount = activity?.sessions.length ?? 0
  const issueCount = activity?.issues.length ?? 0

  return (
    <div className="border-b-2 border-[color:var(--border-subtle)] p-4">
      <CollapsibleSection
        title={`Feedback Activity${!isLoading ? ` (${sessionCount} sessions, ${issueCount} issues)` : ''}`}
        variant="flat"
        defaultExpanded
      >
        {isLoading ? (
          <div className="flex justify-center py-2"><Spinner /></div>
        ) : (
          <div className="flex flex-col gap-4">
            {/* Sessions */}
            {sessionCount > 0 && (
              <div className="flex flex-col gap-1">
                <span className="font-mono text-xs uppercase tracking-wide text-[color:var(--text-secondary)]">
                  Sessions
                </span>
                {activity!.sessions.map((session) => (
                  <Link
                    key={session.id}
                    href={`/projects/${projectId}/sessions?session=${session.id}`}
                    className="flex items-center gap-2 rounded-[4px] px-1 py-1 text-sm transition hover:bg-[color:var(--surface-hover)]"
                  >
                    <Badge variant={SOURCE_BADGE_VARIANTS[session.source] ?? 'default'}>
                      {session.source.charAt(0).toUpperCase() + session.source.slice(1)}
                    </Badge>
                    <span className="min-w-0 flex-1 truncate text-[color:var(--foreground)]">
                      {session.name || 'Unnamed'}
                    </span>
                    <span className="shrink-0 text-xs text-[color:var(--text-tertiary)]">
                      {formatRelativeDate(session.created_at)}
                    </span>
                  </Link>
                ))}
              </div>
            )}

            {/* Issues */}
            {issueCount > 0 && (
              <div className="flex flex-col gap-1">
                <span className="font-mono text-xs uppercase tracking-wide text-[color:var(--text-secondary)]">
                  Issues
                </span>
                {activity!.issues.map((issue) => (
                  <Link
                    key={issue.id}
                    href={`/projects/${projectId}/issues?issue=${issue.id}`}
                    className="flex items-center gap-2 rounded-[4px] px-1 py-1 text-sm transition hover:bg-[color:var(--surface-hover)]"
                  >
                    <Badge variant={TYPE_BADGE_VARIANTS[issue.type] ?? 'default'}>
                      {TYPE_LABELS[issue.type] ?? issue.type}
                    </Badge>
                    <span className="min-w-0 flex-1 truncate text-[color:var(--foreground)]">
                      {issue.title}
                    </span>
                    <span className="shrink-0 text-xs text-[color:var(--text-tertiary)]">
                      {issue.status}
                    </span>
                  </Link>
                ))}
              </div>
            )}

            {sessionCount === 0 && issueCount === 0 && (
              <p className="text-sm text-[color:var(--text-secondary)]">No feedback activity yet</p>
            )}
          </div>
        )}
      </CollapsibleSection>
    </div>
  )
}
