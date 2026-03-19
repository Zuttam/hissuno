'use client'

import { useState } from 'react'
import { Tabs, TabsList, Tab, TabsPanel } from '@/components/ui/tabs'
import { MarkdownContent } from '@/components/ui/markdown-content'
import { Button } from '@/components/ui'
import { Textarea } from '@/components/ui/textarea'
import { updatePackage } from '@/lib/api/knowledge'

const CONTENT_TABS = [
  { key: 'faq', label: 'FAQ', field: 'faq_content' },
  { key: 'howto', label: 'How-To', field: 'howto_content' },
  { key: 'features', label: 'Features', field: 'feature_docs_content' },
  { key: 'troubleshooting', label: 'Troubleshooting', field: 'troubleshooting_content' },
] as const

type ContentField = (typeof CONTENT_TABS)[number]['field']

interface PackageContentTabsProps {
  projectId: string
  packageId: string
  faqContent: string | null
  howtoContent: string | null
  featureDocsContent: string | null
  troubleshootingContent: string | null
  onContentSaved: () => void
}

const proseClasses = [
  'prose-sm',
  'prose-headings:font-mono prose-headings:uppercase prose-headings:tracking-tight',
  'prose-h1:text-2xl prose-h1:border-b prose-h1:border-[color:var(--border-subtle)] prose-h1:pb-4',
  'prose-h2:text-xl prose-h2:text-[color:var(--foreground)]',
  'prose-h3:text-lg prose-h3:text-[color:var(--text-secondary)]',
  'prose-p:text-[color:var(--foreground)] prose-p:leading-relaxed',
  'prose-li:text-[color:var(--foreground)]',
  'prose-strong:text-[color:var(--foreground)]',
  'prose-code:text-[color:var(--accent-selected)] prose-code:bg-[color:var(--surface)] prose-code:px-1 prose-code:py-0.5 prose-code:rounded',
  'prose-pre:bg-[color:var(--surface)] prose-pre:border prose-pre:border-[color:var(--border-subtle)]',
  'prose-a:text-[color:var(--accent-selected)] prose-a:no-underline hover:prose-a:underline',
  'prose-blockquote:border-l-[color:var(--accent-selected)] prose-blockquote:text-[color:var(--text-secondary)]',
  'prose-table:border-collapse',
  'prose-th:bg-[color:var(--surface)] prose-th:font-mono prose-th:uppercase prose-th:text-xs prose-th:tracking-wide',
  'prose-td:border prose-td:border-[color:var(--border-subtle)] prose-td:p-2',
].join(' ')

function getContentForField(
  props: PackageContentTabsProps,
  field: ContentField,
): string | null {
  switch (field) {
    case 'faq_content':
      return props.faqContent
    case 'howto_content':
      return props.howtoContent
    case 'feature_docs_content':
      return props.featureDocsContent
    case 'troubleshooting_content':
      return props.troubleshootingContent
  }
}

export function PackageContentTabs(props: PackageContentTabsProps) {
  const { projectId, packageId, onContentSaved } = props
  const [activeTab, setActiveTab] = useState<string>(CONTENT_TABS[0].key)
  const [editingTab, setEditingTab] = useState<string | null>(null)
  const [editedContent, setEditedContent] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const handleEdit = (tabKey: string, currentContent: string | null) => {
    setEditingTab(tabKey)
    setEditedContent(currentContent ?? '')
  }

  const handleCancel = () => {
    setEditingTab(null)
    setEditedContent('')
  }

  const handleSave = async (field: ContentField) => {
    setIsSaving(true)
    try {
      await updatePackage(projectId, packageId, { [field]: editedContent })
      setEditingTab(null)
      setEditedContent('')
      onContentSaved()
    } catch (err) {
      console.error('[PackageContentTabs] save failed', err)
    } finally {
      setIsSaving(false)
    }
  }

  const handleTabChange = (value: string) => {
    setActiveTab(value)
    // Exit edit mode when switching tabs
    if (editingTab) {
      setEditingTab(null)
      setEditedContent('')
    }
  }

  const activeTabConfig = CONTENT_TABS.find((t) => t.key === activeTab)!
  const activeContent = getContentForField(props, activeTabConfig.field)

  return (
    <Tabs value={activeTab} onChange={handleTabChange}>
      <div className="flex items-center justify-between">
        <TabsList className="px-0">
          {CONTENT_TABS.map((tab) => (
              <Tab key={tab.key} value={tab.key}>
                {tab.label}
              </Tab>
            ))}
        </TabsList>
        {editingTab !== activeTab && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleEdit(activeTab, activeContent)}
          >
            Edit
          </Button>
        )}
      </div>

      {CONTENT_TABS.map((tab) => {
        const content = getContentForField(props, tab.field)
        const isEditing = editingTab === tab.key

        return (
          <TabsPanel key={tab.key} value={tab.key} className="px-0 py-3">
            {isEditing ? (
              <div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Textarea
                    value={editedContent}
                    onChange={(e) => setEditedContent(e.target.value)}
                    className="min-h-[250px] resize-y font-mono text-sm"
                    placeholder={`Write ${tab.label} content in markdown...`}
                  />
                  <div className="min-h-[250px] max-h-[400px] overflow-y-auto rounded-[4px] border-2 border-[color:var(--border-subtle)] bg-[color:var(--background)] p-3">
                    {editedContent ? (
                      <MarkdownContent
                        content={editedContent}
                        className={proseClasses}
                      />
                    ) : (
                      <p className="text-sm text-[color:var(--text-secondary)] italic">
                        Preview will appear here...
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCancel}
                    disabled={isSaving}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => void handleSave(tab.field)}
                    disabled={isSaving}
                    loading={isSaving}
                  >
                    Save
                  </Button>
                </div>
              </div>
            ) : (
              <div>
                {content ? (
                  <div className="max-h-[300px] overflow-y-auto">
                    <MarkdownContent
                      content={content}
                      className={proseClasses}
                    />
                  </div>
                ) : (
                  <p className="text-sm text-[color:var(--text-secondary)] py-4">
                    No content yet - compile the package or click Edit to add manually.
                  </p>
                )}
              </div>
            )}
          </TabsPanel>
        )
      })}
    </Tabs>
  )
}
