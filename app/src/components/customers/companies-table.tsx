'use client'

import { Badge } from '@/components/ui'
import { formatRelativeTime } from '@/lib/utils/format-time'
import type { CompanyWithContacts, CompanyStage } from '@/types/customer'

interface CompaniesTableProps {
  companies: CompanyWithContacts[]
  selectedCompanyId: string | null
  onSelectCompany: (company: CompanyWithContacts) => void
  onArchive: (company: CompanyWithContacts) => void
}

export function CompaniesTable({
  companies,
  selectedCompanyId,
  onSelectCompany,
  onArchive,
}: CompaniesTableProps) {
  return (
    <div className="overflow-hidden rounded-[4px] border border-[color:var(--border-subtle)] bg-[color:var(--background)]">
      <table className="w-full font-mono text-sm">
        <thead>
          <tr className="border-b border-[color:var(--border-subtle)]">
            <th className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wider text-[color:var(--text-secondary)]">
              Name
            </th>
            <th className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wider text-[color:var(--text-secondary)]">
              Domain
            </th>
            <th className="px-3 py-2 text-right text-xs font-bold uppercase tracking-wider text-[color:var(--text-secondary)]">
              ARR
            </th>
            <th className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wider text-[color:var(--text-secondary)]">
              Stage
            </th>
            <th className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wider text-[color:var(--text-secondary)]">
              Plan
            </th>
            <th className="px-3 py-2 text-center text-xs font-bold uppercase tracking-wider text-[color:var(--text-secondary)]">
              Health
            </th>
            <th className="px-3 py-2 text-center text-xs font-bold uppercase tracking-wider text-[color:var(--text-secondary)]">
              Contacts
            </th>
            <th className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wider text-[color:var(--text-secondary)]">
              Updated
            </th>
            <th className="w-12 px-3 py-2">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {companies.map((company) => (
            <CompanyRow
              key={company.id}
              company={company}
              isSelected={selectedCompanyId === company.id}
              onSelect={() => onSelectCompany(company)}
              onArchive={() => onArchive(company)}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}

interface CompanyRowProps {
  company: CompanyWithContacts
  isSelected: boolean
  onSelect: () => void
  onArchive: () => void
}

function CompanyRow({ company, isSelected, onSelect, onArchive }: CompanyRowProps) {
  const truncatedName = company.name.length > 40
    ? `${company.name.slice(0, 40)}...`
    : company.name

  return (
    <tr
      onClick={onSelect}
      className={`cursor-pointer border-b border-[color:var(--border-subtle)] transition-colors ${
        isSelected
          ? 'bg-[color:var(--accent-primary)]/10'
          : 'hover:bg-[color:var(--surface-hover)]'
      } ${company.is_archived ? 'opacity-60' : ''}`}
    >
      <td className="px-3 py-2">
        <span className="inline-flex items-center gap-2">
          <span className="text-[color:var(--foreground)]" title={company.name}>
            {truncatedName}
          </span>
          {company.is_archived && (
            <Badge variant="default">Archived</Badge>
          )}
        </span>
      </td>
      <td className="px-3 py-2 text-[color:var(--text-secondary)]">
        {company.domain}
      </td>
      <td className="px-3 py-2 text-right">
        {company.arr ? (
          <span className="text-[color:var(--foreground)]">
            ${formatNumber(company.arr)}
          </span>
        ) : (
          <span className="text-[color:var(--text-secondary)]">-</span>
        )}
      </td>
      <td className="px-3 py-2">
        <StageBadge stage={company.stage} />
      </td>
      <td className="px-3 py-2 text-[color:var(--text-secondary)]">
        {company.plan_tier || '-'}
      </td>
      <td className="px-3 py-2 text-center">
        <HealthBadge score={company.health_score} />
      </td>
      <td className="px-3 py-2 text-center">
        <span className="text-[color:var(--foreground)]">{company.contact_count}</span>
      </td>
      <td className="px-3 py-2">
        <span className="text-[color:var(--text-secondary)]">
          {formatRelativeTime(company.updated_at)}
        </span>
      </td>
      <td className="px-3 py-2">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onArchive()
          }}
          className="rounded-[4px] p-1.5 text-[color:var(--text-secondary)] transition hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--accent-primary)]"
          aria-label={company.is_archived ? 'Unarchive company' : 'Archive company'}
          title={company.is_archived ? 'Unarchive' : 'Archive'}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="4" width="20" height="5" rx="2" />
            <path d="M4 9v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9" />
            <path d="M10 13h4" />
          </svg>
        </button>
      </td>
    </tr>
  )
}

function StageBadge({ stage }: { stage: CompanyStage }) {
  const variants: Record<CompanyStage, 'default' | 'info' | 'success' | 'warning' | 'danger'> = {
    prospect: 'default',
    onboarding: 'info',
    active: 'success',
    churned: 'danger',
    expansion: 'warning',
  }

  const labels: Record<CompanyStage, string> = {
    prospect: 'Prospect',
    onboarding: 'Onboarding',
    active: 'Active',
    churned: 'Churned',
    expansion: 'Expansion',
  }

  return <Badge variant={variants[stage]}>{labels[stage]}</Badge>
}

function HealthBadge({ score }: { score: number | null }) {
  if (score === null) {
    return <span className="text-[color:var(--text-secondary)]">-</span>
  }

  const getColor = (s: number) => {
    if (s >= 70) return 'text-[color:var(--accent-success)]'
    if (s >= 40) return 'text-[color:var(--accent-warning)]'
    return 'text-[color:var(--accent-danger)]'
  }

  return (
    <span className={`font-bold ${getColor(score)}`} title={`Health score: ${score}/100`}>
      {score}
    </span>
  )
}

function formatNumber(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`
  if (num >= 1_000) return `${(num / 1_000).toFixed(0)}K`
  return num.toFixed(0)
}

