'use client'

import {
  Button,
  Spinner,
  Tabs,
  TabsList,
  Tab,
  TabsPanel,
  Textarea,
} from '@/components/ui'
import { KnowledgeViewer } from './knowledge-viewer'
import type { KnowledgeCategory, KnowledgePackageRecord } from '@/lib/knowledge/types'

const CATEGORIES: KnowledgeCategory[] = ['business', 'product', 'technical', 'faq', 'how_to']

const CATEGORY_LABELS: Record<KnowledgeCategory, string> = {
  business: 'Business',
  product: 'Product',
  technical: 'Technical',
  faq: 'FAQ',
  how_to: 'How-To',
}

export interface CategoryContent {
  content: string | null
  version?: number
  generatedAt?: string
  isLoading: boolean
  error: string | null
}

interface CategoryTabsProps {
  packageId: string
  activeCategory: KnowledgeCategory
  categoryContents: Record<KnowledgeCategory, CategoryContent> | undefined
  categories: KnowledgePackageRecord[] | undefined
  isEditing: boolean
  editedContent: string
  isSavingContent: boolean
  onCategoryChange: (category: KnowledgeCategory) => void
  onStartEdit: () => void
  onCancelEdit: () => void
  onSaveContent: () => void
  onEditedContentChange: (content: string) => void
}

export function CategoryTabs({
  activeCategory,
  categoryContents,
  categories,
  isEditing,
  editedContent,
  isSavingContent,
  onCategoryChange,
  onStartEdit,
  onCancelEdit,
  onSaveContent,
  onEditedContentChange,
}: CategoryTabsProps) {
  const currentContent = categoryContents?.[activeCategory]
  const hasContent = categories && categories.length > 0

  return (
    <Tabs
      value={activeCategory}
      onChange={(val) => onCategoryChange(val as KnowledgeCategory)}
    >
      <div className="flex items-center justify-between">
        <TabsList className="border-0">
          {CATEGORIES.map((cat) => {
            const catContent = categoryContents?.[cat]
            const version = catContent?.version
            const hasCategoryContent = categories?.some((c) => c.category === cat)
            return (
              <Tab key={cat} value={cat}>
                <span className={hasCategoryContent ? '' : 'opacity-50'}>
                  {CATEGORY_LABELS[cat]}
                  {version && (
                    <span className="ml-1 text-[10px] text-[color:var(--text-tertiary)]">
                      v{version}
                    </span>
                  )}
                </span>
              </Tab>
            )
          })}
        </TabsList>
        <div className="pr-4 flex gap-2">
          {isEditing ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={onCancelEdit}
                disabled={isSavingContent}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={onSaveContent}
                loading={isSavingContent}
                disabled={isSavingContent || editedContent === (currentContent?.content ?? '')}
              >
                Save
              </Button>
            </>
          ) : (
            hasContent && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onStartEdit}
                disabled={currentContent?.isLoading}
              >
                Edit
              </Button>
            )
          )}
        </div>
      </div>

      {CATEGORIES.map((cat) => (
        <TabsPanel key={cat} value={cat} className="p-0">
          <div className="p-4 min-h-[200px] max-h-[400px] overflow-y-auto">
            {currentContent?.isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Spinner size="md" />
              </div>
            ) : currentContent?.error ? (
              <div className="rounded-[4px] border-2 border-[color:var(--accent-danger)] bg-[color:var(--accent-danger)]/10 p-4 text-sm text-[color:var(--accent-danger)]">
                {currentContent.error}
              </div>
            ) : isEditing ? (
              <Textarea
                value={editedContent}
                onChange={(e) => onEditedContentChange(e.target.value)}
                className="min-h-[300px] resize-y font-mono text-sm"
                disabled={isSavingContent}
                placeholder="Enter markdown content..."
              />
            ) : currentContent?.content ? (
              <KnowledgeViewer content={currentContent.content} className="max-h-none" />
            ) : (
              <div className="text-center text-[color:var(--text-secondary)] py-12">
                No content generated for this category yet.
                <br />
                <span className="text-sm">
                  Open settings to configure sources and run analysis.
                </span>
              </div>
            )}
          </div>
        </TabsPanel>
      ))}
    </Tabs>
  )
}

export { CATEGORIES, CATEGORY_LABELS }
