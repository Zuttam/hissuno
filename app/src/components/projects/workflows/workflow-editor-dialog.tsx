'use client'

import { useState, useEffect } from 'react'
import { Dialog, Button, Alert } from '@/components/ui'

export interface WorkflowStepConfig {
  id: string
  name: string
  description: string
  guidelineKey?: string
  placeholder?: string
  rows?: number
}

interface WorkflowEditorDialogProps {
  open: boolean
  onClose: () => void
  title: string
  subtitle: string
  projectId: string
  steps: WorkflowStepConfig[]
  initialValues: Record<string, string>
  onSaved: () => void
  saveFn: (projectId: string, values: Record<string, unknown>) => Promise<unknown>
}

export function WorkflowEditorDialog({
  open,
  onClose,
  title,
  subtitle,
  projectId,
  steps,
  initialValues,
  onSaved,
  saveFn,
}: WorkflowEditorDialogProps) {
  const [values, setValues] = useState<Record<string, string>>(initialValues)
  const [expandedStepId, setExpandedStepId] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setValues(initialValues)
      setExpandedStepId(null)
      setError(null)
    }
  }, [open, initialValues])

  const handleToggleStep = (stepId: string) => {
    setExpandedStepId((prev) => (prev === stepId ? null : stepId))
  }

  const handleSave = async () => {
    setIsSaving(true)
    setError(null)

    try {
      await saveFn(projectId, values)

      onSaved()
      onClose()
    } catch {
      setError('Failed to save settings. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={title} size="xl">
      <div className="flex flex-col gap-6">
        <p className="text-sm text-[color:var(--text-secondary)]">{subtitle}</p>

        {error && <Alert variant="warning">{error}</Alert>}

        {/* Pipeline steps */}
        <div className="flex flex-col">
          {steps.map((step, index) => {
            const isConfigurable = !!step.guidelineKey
            const isExpanded = expandedStepId === step.id
            const isLast = index === steps.length - 1

            return (
              <div key={step.id} className="flex gap-3">
                {/* Left: circle + connector line */}
                <div className="flex flex-col items-center">
                  <div
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold ${
                      isConfigurable
                        ? 'border-[color:var(--accent-selected)] text-[color:var(--accent-selected)]'
                        : 'border-[color:var(--border-subtle)] text-[color:var(--text-tertiary)]'
                    }`}
                  >
                    {index + 1}
                  </div>
                  {!isLast && (
                    <div className="w-0.5 flex-1 min-h-3 bg-[color:var(--border-subtle)]" />
                  )}
                </div>

                {/* Right: step content */}
                <div className={`flex-1 ${isLast ? '' : 'pb-3'}`}>
                  {/* Step header */}
                  {isConfigurable ? (
                    <button
                      type="button"
                      onClick={() => handleToggleStep(step.id)}
                      className="group flex w-full items-center gap-2 text-left"
                    >
                      <div className="flex-1">
                        <span className="text-sm font-medium text-[color:var(--foreground)]">
                          {step.name}
                        </span>
                        <p className="text-xs text-[color:var(--text-tertiary)] mt-0.5">
                          {step.description}
                        </p>
                      </div>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className={`shrink-0 text-[color:var(--text-tertiary)] transition-transform group-hover:text-[color:var(--foreground)] ${
                          isExpanded ? 'rotate-90' : ''
                        }`}
                      >
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </button>
                  ) : (
                    <div>
                      <span className="text-sm text-[color:var(--text-tertiary)]">
                        {step.name}
                      </span>
                      <p className="text-xs text-[color:var(--text-tertiary)] mt-0.5">
                        {step.description}
                      </p>
                    </div>
                  )}

                  {/* Expanded textarea */}
                  {isConfigurable && isExpanded && step.guidelineKey && (
                    <div className="mt-3 rounded-[4px]">
                      <textarea
                        value={values[step.guidelineKey] ?? ''}
                        onChange={(e) =>
                          setValues((prev) => ({
                            ...prev,
                            [step.guidelineKey!]: e.target.value,
                          }))
                        }
                        placeholder={step.placeholder}
                        rows={step.rows ?? 6}
                        className="w-full rounded-[4px] border border-[color:var(--border-subtle)] bg-[color:var(--surface)] px-3 py-2 font-mono text-sm text-[color:var(--foreground)] placeholder:text-[color:var(--text-tertiary)] focus:border-[color:var(--accent-selected)] focus:outline-none"
                      />
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-[color:var(--border-subtle)] pt-4">
          <Button variant="secondary" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave} loading={isSaving} disabled={isSaving}>
            Save
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
