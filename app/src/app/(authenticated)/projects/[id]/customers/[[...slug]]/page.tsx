'use client'

import { useState, useCallback, useEffect } from 'react'
import { useSearchParams, useRouter, useParams } from 'next/navigation'
import type { CompanyWithContacts, CompanyFilters, ContactWithCompany, ContactFilters } from '@/types/customer'
import { useProject } from '@/components/providers/project-provider'
import { useCompanies } from '@/hooks/use-companies'
import { useContacts } from '@/hooks/use-contacts'
import { CompaniesFilters } from '@/components/customers/companies-filters'
import { CompaniesTable } from '@/components/customers/companies-table'
import { ContactsFilters } from '@/components/customers/contacts-filters'
import { ContactsTable } from '@/components/customers/contacts-table'
import { CompanySidebar } from '@/components/customers/company-sidebar'
import { ContactSidebar } from '@/components/customers/contact-sidebar'
import { AddDataDialog } from '@/components/customers/add-data-dialog'
import { Plus } from 'lucide-react'
import { Button, PageHeader, Pagination, Spinner, Tabs, TabsList, Tab, TabsPanel } from '@/components/ui'
import { Card } from '@/components/ui/card'
import { AnalyticsStrip } from '@/components/analytics'

const PAGE_SIZE = 25

type ActiveTab = 'companies' | 'contacts'

export default function ProjectCustomersPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const params = useParams<{ id: string; slug?: string[] }>()
  const { project, projectId, isLoading: isLoadingProject } = useProject()

  // Derive selected entity from URL path: /customers/companies/{id} or /customers/contacts/{id}
  const slug = params.slug
  const slugEntity = slug?.[0] as 'companies' | 'contacts' | undefined
  const slugEntityId = slug?.[1] ?? null

  const selectedCompanyId = slugEntity === 'companies' ? slugEntityId : null
  const selectedContactId = slugEntity === 'contacts' ? slugEntityId : null

  // Tab state - derived from URL path or search params
  const [activeTab, setActiveTab] = useState<ActiveTab>('companies')

  // Company state
  const [companyFilters, setCompanyFilters] = useState<CompanyFilters>({})
  const [companyPage, setCompanyPage] = useState(1)

  // Contact state
  const [contactFilters, setContactFilters] = useState<ContactFilters>({})
  const [contactPage, setContactPage] = useState(1)

  // Dialog state
  const [showAddDataDialog, setShowAddDataDialog] = useState(false)

  // URL-driven state
  useEffect(() => {
    const dialog = searchParams.get('dialog')
    if (dialog === 'add-data' || dialog === 'import' || dialog === 'create-company' || dialog === 'create-contact') setShowAddDataDialog(true)

    // Backward compat: redirect old ?company=X / ?contact=X to new path format
    const companyParam = searchParams.get('company')
    if (companyParam && projectId) {
      router.replace(`/projects/${projectId}/customers/companies/${companyParam}`)
      return
    }

    const contactParam = searchParams.get('contact')
    if (contactParam && projectId) {
      router.replace(`/projects/${projectId}/customers/contacts/${contactParam}`)
      return
    }

    // Set active tab from URL
    if (slugEntity === 'contacts' || searchParams.get('tab') === 'contacts') {
      setActiveTab('contacts')
    } else if (slugEntity === 'companies') {
      setActiveTab('companies')
    }
  }, [searchParams, slugEntity, projectId, router])

  // Set project filter when projectId becomes available
  useEffect(() => {
    if (projectId) {
      setCompanyFilters((prev) => ({ ...prev, projectId }))
      setContactFilters((prev) => ({ ...prev, projectId }))
    }
  }, [projectId])

  // Companies data
  const paginatedCompanyFilters = {
    ...companyFilters,
    limit: PAGE_SIZE,
    offset: (companyPage - 1) * PAGE_SIZE,
  }

  const {
    companies,
    total: companyTotal,
    isLoading: isLoadingCompanies,
    error: companyError,
    refresh: refreshCompanies,
    createCompany,
    archiveCompany,
  } = useCompanies({ filters: paginatedCompanyFilters })

  // Contacts data
  const paginatedContactFilters = {
    ...contactFilters,
    limit: PAGE_SIZE,
    offset: (contactPage - 1) * PAGE_SIZE,
  }

  const {
    contacts,
    total: contactTotal,
    isLoading: isLoadingContacts,
    error: contactError,
    refresh: refreshContacts,
    createContact,
    archiveContact,
  } = useContacts({ filters: paginatedContactFilters })

  // Handlers
  const handleCompanyFilterChange = useCallback(
    (newFilters: CompanyFilters) => {
      if (projectId) {
        setCompanyFilters({ ...newFilters, projectId })
        setCompanyPage(1)
      }
    },
    [projectId]
  )

  const handleContactFilterChange = useCallback(
    (newFilters: ContactFilters) => {
      if (projectId) {
        setContactFilters({ ...newFilters, projectId })
        setContactPage(1)
      }
    },
    [projectId]
  )

  const handleCompanySelect = useCallback((company: CompanyWithContacts) => {
    if (projectId) {
      router.push(`/projects/${projectId}/customers/companies/${company.id}`)
    }
  }, [projectId, router])

  const handleContactSelect = useCallback((contact: ContactWithCompany) => {
    if (projectId) {
      router.push(`/projects/${projectId}/customers/contacts/${contact.id}`)
    }
  }, [projectId, router])

  const handleCloseCompanySidebar = useCallback(() => {
    if (projectId) {
      router.push(`/projects/${projectId}/customers`)
    }
  }, [projectId, router])

  const handleCloseContactSidebar = useCallback(() => {
    if (projectId) {
      router.push(`/projects/${projectId}/customers?tab=contacts`)
    }
  }, [projectId, router])

  const handleCompanyUpdated = useCallback(() => {
    void refreshCompanies()
  }, [refreshCompanies])

  const handleContactUpdated = useCallback(() => {
    void refreshContacts()
  }, [refreshContacts])

  const handleArchiveCompany = useCallback(
    async (company: CompanyWithContacts) => {
      await archiveCompany(company.id, !company.is_archived)
    },
    [archiveCompany]
  )

  const handleArchiveContact = useCallback(
    async (contact: ContactWithCompany) => {
      await archiveContact(contact.id, !contact.is_archived)
    },
    [archiveContact]
  )

  const handleDataAdded = useCallback(() => {
    void refreshCompanies()
    void refreshContacts()
  }, [refreshCompanies, refreshContacts])

  const handleRefresh = useCallback(() => {
    void refreshCompanies()
    void refreshContacts()
  }, [refreshCompanies, refreshContacts])

  // Clear URL param when dialogs close
  const clearDialogParam = useCallback(() => {
    if (searchParams.get('dialog')) {
      router.replace(`/projects/${projectId}/customers`)
    }
  }, [searchParams, router, projectId])

  const handleCloseAddDataDialog = () => {
    setShowAddDataDialog(false)
    clearDialogParam()
  }

  // Loading state
  if (isLoadingProject || !project || !projectId) {
    return (
      <>
        <PageHeader title="Customers" />
        <div className="flex flex-1 items-center justify-center">
          <Spinner size="lg" />
        </div>
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Customers"
        onRefresh={handleRefresh}
        actions={
          <button
            type="button"
            onClick={() => setShowAddDataDialog(true)}
            className="flex items-center gap-1.5 rounded-[4px] border border-[color:var(--border-subtle)] px-2.5 py-1.5 text-xs font-medium text-[color:var(--text-secondary)] transition hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--foreground)]"
          >
            <Plus size={14} />
            Add Customers
          </button>
        }
      />

      <AnalyticsStrip type="customers" projectId={projectId} />

      <Tabs value={activeTab} onChange={(v) => setActiveTab(v as ActiveTab)} className="flex-1">
        <TabsList className="px-0">
          <Tab value="companies">Companies</Tab>
          <Tab value="contacts">Contacts</Tab>
        </TabsList>

        <TabsPanel value="companies" className="px-0 py-0">
          <Card className="mt-4 flex flex-col gap-6">
            <CompaniesFilters filters={companyFilters} onFilterChange={handleCompanyFilterChange} />

            {companyError && (
              <div className="rounded-[4px] border-2 border-[color:var(--accent-danger)] bg-transparent p-4 font-mono text-sm text-[color:var(--foreground)]">
                {companyError}
              </div>
            )}

            {isLoadingCompanies && companies.length === 0 ? (
              <TableSkeleton />
            ) : companies.length === 0 ? (
              hasActiveFilters(companyFilters) ? (
                <FilteredEmptyState onClearFilters={() => handleCompanyFilterChange({})} />
              ) : (
                <EmptyState entityType="companies" />
              )
            ) : (
              <>
                <CompaniesTable
                  companies={companies}
                  selectedCompanyId={selectedCompanyId}
                  onSelectCompany={handleCompanySelect}
                  onArchive={handleArchiveCompany}
                />
                <Pagination
                  currentPage={companyPage}
                  pageSize={PAGE_SIZE}
                  total={companyTotal}
                  onPageChange={setCompanyPage}
                />
              </>
            )}
          </Card>
        </TabsPanel>

        <TabsPanel value="contacts" className="px-0 py-0">
          <Card className="mt-4 flex flex-col gap-6">
            <ContactsFilters
              filters={contactFilters}
              onFilterChange={handleContactFilterChange}
              companies={companies.map((c) => ({ id: c.id, name: c.name }))}
            />

            {contactError && (
              <div className="rounded-[4px] border-2 border-[color:var(--accent-danger)] bg-transparent p-4 font-mono text-sm text-[color:var(--foreground)]">
                {contactError}
              </div>
            )}

            {isLoadingContacts && contacts.length === 0 ? (
              <TableSkeleton />
            ) : contacts.length === 0 ? (
              hasActiveFilters(contactFilters) ? (
                <FilteredEmptyState onClearFilters={() => handleContactFilterChange({})} />
              ) : (
                <EmptyState entityType="contacts" />
              )
            ) : (
              <>
                <ContactsTable
                  contacts={contacts}
                  selectedContactId={selectedContactId}
                  onSelectContact={handleContactSelect}
                  onArchive={handleArchiveContact}
                />
                <Pagination
                  currentPage={contactPage}
                  pageSize={PAGE_SIZE}
                  total={contactTotal}
                  onPageChange={setContactPage}
                />
              </>
            )}
          </Card>
        </TabsPanel>
      </Tabs>

      {/* Sidebars */}
      {selectedCompanyId && projectId && (
        <CompanySidebar
          projectId={projectId}
          companyId={selectedCompanyId}
          onClose={handleCloseCompanySidebar}
          onCompanyUpdated={handleCompanyUpdated}
        />
      )}

      {selectedContactId && projectId && (
        <ContactSidebar
          projectId={projectId}
          contactId={selectedContactId}
          onClose={handleCloseContactSidebar}
          onContactUpdated={handleContactUpdated}
        />
      )}

      {/* Dialogs */}
      <AddDataDialog
        open={showAddDataDialog}
        onClose={handleCloseAddDataDialog}
        projectId={projectId}
        onDataAdded={handleDataAdded}
        defaultEntityType={activeTab === 'companies' ? 'company' : 'contact'}
        onCreateCompany={createCompany}
        onCreateContact={createContact}
      />

    </>
  )
}

function TableSkeleton() {
  return (
    <div className="rounded-[4px] border-2 border-[color:var(--border-subtle)] bg-[color:var(--background)]">
      <div className="animate-pulse">
        {Array.from({ length: 5 }).map((_, index) => (
          <div
            key={index}
            className="h-16 border-b border-[color:var(--border-subtle)] bg-[color:var(--surface)]"
          />
        ))}
      </div>
    </div>
  )
}

function hasActiveFilters(filters: CompanyFilters | ContactFilters): boolean {
  const { projectId, limit, offset, showArchived, ...rest } = filters as Record<string, unknown>
  return Object.values(rest).some((v) => v !== undefined && v !== '' && v !== null)
}

function FilteredEmptyState({ onClearFilters }: { onClearFilters: () => void }) {
  return (
    <div className="relative overflow-hidden rounded-[4px] border-2 border-dashed border-[color:var(--border-subtle)] bg-[color:var(--surface)] px-10 py-14 text-center">
      <div className="mx-auto max-w-xl space-y-4">
        <h2 className="font-mono text-2xl font-bold uppercase text-[color:var(--foreground)]">
          No matching results
        </h2>
        <p className="text-sm text-[color:var(--text-secondary)]">
          No results match your current filters. Try adjusting or clearing them.
        </p>
        <Button variant="secondary" size="sm" onClick={onClearFilters}>
          Clear Filters
        </Button>
      </div>
    </div>
  )
}

function EmptyState({ entityType }: { entityType: 'companies' | 'contacts' }) {
  return (
    <div className="relative overflow-hidden rounded-[4px] border-2 border-dashed border-[color:var(--border-subtle)] bg-[color:var(--surface)] px-10 py-14 text-center">
      <div className="mx-auto max-w-xl space-y-4">
        <h2 className="font-mono text-2xl font-bold uppercase text-[color:var(--foreground)]">
          No {entityType} yet
        </h2>
        <p className="text-sm text-[color:var(--text-secondary)]">
          {entityType === 'companies'
            ? 'Add companies manually or import them from a CSV file to start tracking your customer base.'
            : 'Add contacts manually or import them from a CSV file to manage your customer relationships.'}
        </p>
      </div>
    </div>
  )
}
