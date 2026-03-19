'use client'

import { Badge } from '@/components/ui'
import { formatRelativeTime } from '@/lib/utils/format-time'
import type { ContactWithCompany } from '@/types/customer'

interface ContactsTableProps {
  contacts: ContactWithCompany[]
  selectedContactId: string | null
  onSelectContact: (contact: ContactWithCompany) => void
  onArchive: (contact: ContactWithCompany) => void
}

export function ContactsTable({
  contacts,
  selectedContactId,
  onSelectContact,
  onArchive,
}: ContactsTableProps) {
  return (
    <div className="overflow-hidden rounded-[4px] border border-[color:var(--border-subtle)] bg-[color:var(--background)]">
      <table className="w-full font-mono text-sm">
        <thead>
          <tr className="border-b border-[color:var(--border-subtle)]">
            <th className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wider text-[color:var(--text-secondary)]">
              Name
            </th>
            <th className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wider text-[color:var(--text-secondary)]">
              Email
            </th>
            <th className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wider text-[color:var(--text-secondary)]">
              Company
            </th>
            <th className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wider text-[color:var(--text-secondary)]">
              Role / Title
            </th>
            <th className="px-3 py-2 text-center text-xs font-bold uppercase tracking-wider text-[color:var(--text-secondary)]">
              Champion
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
          {contacts.map((contact) => (
            <ContactRow
              key={contact.id}
              contact={contact}
              isSelected={selectedContactId === contact.id}
              onSelect={() => onSelectContact(contact)}
              onArchive={() => onArchive(contact)}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}

interface ContactRowProps {
  contact: ContactWithCompany
  isSelected: boolean
  onSelect: () => void
  onArchive: () => void
}

function ContactRow({ contact, isSelected, onSelect, onArchive }: ContactRowProps) {
  const truncatedName = contact.name.length > 30
    ? `${contact.name.slice(0, 30)}...`
    : contact.name

  const roleDisplay = contact.title || contact.role || '-'

  return (
    <tr
      onClick={onSelect}
      className={`cursor-pointer border-b border-[color:var(--border-subtle)] transition-colors ${
        isSelected
          ? 'bg-[color:var(--accent-primary)]/10'
          : 'hover:bg-[color:var(--surface-hover)]'
      } ${contact.is_archived ? 'opacity-60' : ''}`}
    >
      <td className="px-3 py-2">
        <span className="inline-flex items-center gap-2">
          <span className="text-[color:var(--foreground)]" title={contact.name}>
            {truncatedName}
          </span>
          {contact.is_archived && (
            <Badge variant="default">Archived</Badge>
          )}
        </span>
      </td>
      <td className="px-3 py-2 text-[color:var(--text-secondary)]">
        {contact.email}
      </td>
      <td className="px-3 py-2">
        {contact.company ? (
          <span className="text-[color:var(--foreground)]">{contact.company.name}</span>
        ) : (
          <span className="text-[color:var(--text-secondary)]">-</span>
        )}
      </td>
      <td className="px-3 py-2 text-[color:var(--text-secondary)]">
        {roleDisplay}
      </td>
      <td className="px-3 py-2 text-center">
        {contact.is_champion ? (
          <Badge variant="warning">Champion</Badge>
        ) : (
          <span className="text-[color:var(--text-secondary)]">-</span>
        )}
      </td>
      <td className="px-3 py-2">
        <span className="text-[color:var(--text-secondary)]">
          {formatRelativeTime(contact.updated_at)}
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
          aria-label={contact.is_archived ? 'Unarchive contact' : 'Archive contact'}
          title={contact.is_archived ? 'Unarchive' : 'Archive'}
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

