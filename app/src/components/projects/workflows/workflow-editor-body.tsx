'use client'

import { useState, useEffect } from 'react'
import { Button, Alert } from '@/components/ui'

export interface WorkflowStepConfig {
  id: string
  name: string
  description: string
  guidelineKey?: string
  placeholder?: string
  rows?: number
  toggleKey?: string
}

export interface WorkflowEditorBodyProps {
  subtitle?: string
  projectId: string
  steps: WorkflowStepConfig[]
  initialValues: Record<string, string | boolean>
  onSaved: () => void
  saveFn: (projectId: string, values: Record<string, unknown>) => Promise<unknown>
  masterToggleKey?: string
  masterToggleLabel?: string
  baseStepCount?: number
  onCancel?: () => void
  cancelLabel?: string
  saveLabel?: string
}

export function WorkflowEditorBody({
  subtitle,
  projectId,
  steps,
  initialValues,
  onSaved,
  saveFn,
  masterToggleKey,
  masterToggleLabel,
  baseStepCount,
  onCancel,
  cancelLabel = 'Cancel',
  saveLabel = 'Save',
}: WorkflowEditorBodyProps) {
  const [values, setValues] = useState<Record<string, string | boolean>>(initialValues)
  const [expandedStepId, setExpandedStepId] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setValues(initialValues)
    setExpandedStepId(null)
    setError(null)
  }, [initialValues])

  const handleToggleStep = (stepId: string) => {
    setExpandedStepId((prev) => (prev === stepId ? null : stepId))
  }

  const handleSave = async () => {
    setIsSaving(true)
    setError(null)

    try {
      await saveFn(projectId, values)
      onSaved()
    } catch {
      setError('Failed to save settings. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {subtitle && <p className="text-sm text-[color:var(--text-secondary)]">{subtitle}</p>}

      {error && <Alert variant="warning">{error}</Alert>}

      {masterToggleKey && masterToggleLabel && (
        <div className="flex items-center justify-between rounded-lg border border-[color:var(--border-subtle)] px-4 py-3">
          <div>
            <span className="text-sm font-medium text-[color:var(--foreground)]">{masterToggleLabel}</span>
            <p className="text-xs text-[color:var(--text-tertiary)] mt-0.5">
              {values[masterToggleKey] !== false
                ? 'Automation runs after base processing completes'
                : 'Only base processing (classify, summarize, graph eval) will run'}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={values[masterToggleKey] !== false}
            onClick={() =>
              setValues((prev) => ({
                ...prev,
                [masterToggleKey]: !prev[masterToggleKey],
              }))
            }
            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[color:var(--accent-primary)] focus:ring-offset-2 ${
              values[masterToggleKey] !== false ? 'bg-[color:var(--accent-primary)]' : 'bg-[color:var(--surface-hover)]'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                values[masterToggleKey] !== false ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      )}

      <div className="flex flex-col">
        {steps.map((step, index) => {
          const isConfigurable = !!step.guidelineKey
          const isExpanded = expandedStepId === step.id
          const isLast = index === steps.length - 1
          const hasToggle = !!step.toggleKey
          const isGatedByMaster = masterToggleKey && baseStepCount !== undefined && index >= baseStepCount
          const isMasterEnabled = masterToggleKey ? values[masterToggleKey] !== false : true
          const isStepActive = isGatedByMaster ? isMasterEnabled : true
          const isToggleEnabled = hasToggle ? values[step.toggleKey!] !== false : true

          return (
            <div key={step.id} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold ${
                    !isStepActive || !isToggleEnabled
                      ? 'border-[color:var(--border-subtle)] text-[color:var(--text-tertiary)] opacity-50'
                      : isConfigurable
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

              <div className={`flex-1 ${isLast ? '' : 'pb-3'}`}>
                {isConfigurable && isToggleEnabled && isStepActive ? (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleToggleStep(step.id)}
                      className="group flex flex-1 items-center gap-2 text-left"
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
                    {hasToggle && (
                      <button
                        type="button"
                        role="switch"
                        aria-checked={isToggleEnabled}
                        onClick={() =>
                          setValues((prev) => ({
                            ...prev,
                            [step.toggleKey!]: !prev[step.toggleKey!],
                          }))
                        }
                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[color:var(--accent-primary)] focus:ring-offset-2 ${
                          isToggleEnabled ? 'bg-[color:var(--accent-primary)]' : 'bg-[color:var(--surface-hover)]'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            isToggleEnabled ? 'translate-x-4' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <span className={`text-sm ${isStepActive && isToggleEnabled ? 'text-[color:var(--text-tertiary)]' : 'text-[color:var(--text-tertiary)] opacity-50'}`}>
                        {step.name}
                      </span>
                      <p className={`text-xs mt-0.5 ${isStepActive && isToggleEnabled ? 'text-[color:var(--text-tertiary)]' : 'text-[color:var(--text-tertiary)] opacity-50'}`}>
                        {!isStepActive ? 'Disabled (automation off)' : isToggleEnabled ? step.description : 'Disabled'}
                      </p>
                    </div>
                    {hasToggle && (
                      <button
                        type="button"
                        role="switch"
                        aria-checked={isToggleEnabled}
                        onClick={() =>
                          setValues((prev) => ({
                            ...prev,
                            [step.toggleKey!]: !prev[step.toggleKey!],
                          }))
                        }
                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[color:var(--accent-primary)] focus:ring-offset-2 ${
                          isToggleEnabled ? 'bg-[color:var(--accent-primary)]' : 'bg-[color:var(--surface-hover)]'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            isToggleEnabled ? 'translate-x-4' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    )}
                  </div>
                )}

                {isConfigurable && isExpanded && isToggleEnabled && isStepActive && step.guidelineKey && (
                  <div className="mt-3 rounded-[4px]">
                    <textarea
                      value={(values[step.guidelineKey] as string) ?? ''}
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

      <div className="flex items-center justify-end gap-3 border-t border-[color:var(--border-subtle)] pt-4">
        {onCancel && (
          <Button variant="secondary" onClick={onCancel} disabled={isSaving}>
            {cancelLabel}
          </Button>
        )}
        <Button variant="primary" onClick={handleSave} loading={isSaving} disabled={isSaving}>
          {saveLabel}
        </Button>
      </div>
    </div>
  )
}
