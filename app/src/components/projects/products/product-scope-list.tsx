'use client'

import { useState, useCallback, type ChangeEvent } from 'react'
import { Badge, Button, Input, Textarea, FormField, Select } from '@/components/ui'
import type { ProductScopeRecord, ProductScopeType } from '@/types/product-scope'
import type { TagColorVariant } from '@/types/session'
import { generateSlugFromName } from '@/lib/security/sanitize'

const MAX_SCOPES = 20
const MAX_NAME_LENGTH = 50
const MAX_DESCRIPTION_LENGTH = 500

const COLOR_OPTIONS: { value: TagColorVariant; label: string; colorClass: string }[] = [
  { value: 'info', label: 'Blue', colorClass: 'bg-blue-500' },
  { value: 'success', label: 'Green', colorClass: 'bg-green-500' },
  { value: 'warning', label: 'Yellow', colorClass: 'bg-yellow-500' },
  { value: 'danger', label: 'Red', colorClass: 'bg-red-500' },
  { value: 'default', label: 'Gray', colorClass: 'bg-gray-500' },
]

const TYPE_OPTIONS: { value: ProductScopeType; label: string }[] = [
  { value: 'product_area', label: 'Product Area' },
  { value: 'initiative', label: 'Initiative' },
]

interface ProductScopeListProps {
  scopes: ProductScopeRecord[]
  selectedScopeId: string | null
  onSelect: (scopeId: string) => void
  onAdd: (scope: { name: string; slug: string; description: string; color: TagColorVariant; type: ProductScopeType }) => void
  searchQuery: string
}

export function ProductScopeList({
  scopes,
  selectedScopeId,
  onSelect,
  onAdd,
  searchQuery,
}: ProductScopeListProps) {
  const [isAdding, setIsAdding] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [color, setColor] = useState<TagColorVariant>('info')
  const [scopeType, setScopeType] = useState<ProductScopeType>('product_area')
  const [formError, setFormError] = useState<string | null>(null)

  const handleCancel = useCallback(() => {
    setIsAdding(false)
    setName('')
    setDescription('')
    setColor('info')
    setScopeType('product_area')
    setFormError(null)
  }, [])

  const handleSave = useCallback(() => {
    const trimmedName = name.trim()
    if (!trimmedName) {
      setFormError('Name is required.')
      return
    }
    const slug = generateSlugFromName(trimmedName)
    if (!slug || !/^[a-z][a-z0-9_]*$/.test(slug)) {
      setFormError('Name must start with a letter.')
      return
    }
    const existing = scopes.find((a) => a.slug === slug)
    if (existing) {
      setFormError('A product scope with this name already exists.')
      return
    }
    onAdd({ name: trimmedName, slug, description: description.trim(), color, type: scopeType })
    handleCancel()
  }, [name, description, color, scopeType, scopes, onAdd, handleCancel])

  const filtered = searchQuery.trim()
    ? scopes.filter((a) => a.name.toLowerCase().includes(searchQuery.trim().toLowerCase()))
    : scopes

  return (
    <div className="flex flex-col gap-2">
      {filtered.length === 0 && !isAdding && (
        <p className="py-8 text-center text-sm text-[color:var(--text-tertiary)]">
          {searchQuery.trim()
            ? 'No product scopes match your search.'
            : 'No product scopes defined yet. Add your first one below.'}
        </p>
      )}

      {filtered.map((scope) => (
        <button
          key={scope.id}
          type="button"
          onClick={() => onSelect(scope.id)}
          className={`flex items-center gap-3 rounded-lg p-3 text-left transition ${
            selectedScopeId === scope.id
              ? 'bg-[color:var(--surface-selected)] ring-1 ring-[color:var(--accent-selected)]'
              : 'bg-[color:var(--background-secondary)] hover:bg-[color:var(--surface-hover)]'
          }`}
        >
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex items-center gap-2">
              <Badge variant={scope.color as TagColorVariant}>{scope.name}</Badge>
              {scope.type === 'initiative' && (
                <Badge variant="default">Initiative</Badge>
              )}
              {scope.is_default && (
                <span className="text-xs text-[color:var(--text-tertiary)]">(default)</span>
              )}
            </div>
            {scope.description && (
              <p className="line-clamp-2 text-xs text-[color:var(--text-secondary)]">
                {scope.description}
              </p>
            )}
          </div>
        </button>
      ))}

      {/* Add form */}
      {isAdding && (
        <div className="rounded-lg bg-[color:var(--background-secondary)] p-3 space-y-3">
          {formError && (
            <div className="rounded-md bg-[color:var(--background-danger)] p-2 text-xs text-[color:var(--text-danger)]">
              {formError}
            </div>
          )}
          <FormField label="Name">
            <Input
              value={name}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value.substring(0, MAX_NAME_LENGTH))}
              placeholder="e.g., Billing, Onboarding, API"
              maxLength={MAX_NAME_LENGTH}
              autoFocus
            />
          </FormField>
          <FormField label="Type">
            <Select
              value={scopeType}
              onChange={(e: ChangeEvent<HTMLSelectElement>) => setScopeType(e.target.value as ProductScopeType)}
            >
              {TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </Select>
          </FormField>
          <FormField label="Description">
            <Textarea
              value={description}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value.substring(0, MAX_DESCRIPTION_LENGTH))}
              placeholder="What this product scope covers"
              rows={2}
              maxLength={MAX_DESCRIPTION_LENGTH}
            />
          </FormField>
          <FormField as="div" label="Color">
            <div className="flex items-center gap-4">
              <div className="flex gap-2">
                {COLOR_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setColor(option.value)}
                    className={`h-6 w-6 rounded-full ${option.colorClass} transition-all ${
                      color === option.value
                        ? 'ring-2 ring-[color:var(--accent-primary)] ring-offset-2 ring-offset-[color:var(--background)]'
                        : 'hover:scale-110'
                    }`}
                    title={option.label}
                  />
                ))}
              </div>
              {name && <Badge variant={color}>{name}</Badge>}
            </div>
          </FormField>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={handleCancel}>Cancel</Button>
            <Button size="sm" onClick={handleSave}>Add Scope</Button>
          </div>
        </div>
      )}

      {/* Add button */}
      {!isAdding && (
        <div className="flex items-center justify-between pt-1">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setIsAdding(true)}
            disabled={scopes.length >= MAX_SCOPES}
          >
            + Add Product Area or Initiative
          </Button>
          <span className="text-xs text-[color:var(--text-tertiary)]">
            {scopes.length} / {MAX_SCOPES}
          </span>
        </div>
      )}
    </div>
  )
}
