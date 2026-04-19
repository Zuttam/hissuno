'use client'

import { useMemo, useState } from 'react'
import { Button, Alert, Slider, ChipInput, Heading } from '@/components/ui'
import { ToggleSwitch } from '@/components/ui/toggle-switch'
import { updateGraphEvaluationSettingsClient } from '@/lib/api/settings'
import type { GraphEvaluationConfig } from '@/mastra/workflows/graph-evaluation/config'

interface GraphEvaluationPanelProps {
  projectId: string
  config: GraphEvaluationConfig
  onSaved: () => void
}

const THRESHOLD_MIN = 0.3
const THRESHOLD_MAX = 0.95
const THRESHOLD_STEP = 0.05

function formatThreshold(v: number): string {
  return v.toFixed(2)
}

export function GraphEvaluationPanel({ projectId, config, onSaved }: GraphEvaluationPanelProps) {
  const [draft, setDraft] = useState<GraphEvaluationConfig>(config)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<number | null>(null)

  const isDirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(config), [draft, config])

  const updateStrategy = <K extends keyof GraphEvaluationConfig['strategies']>(
    key: K,
    patch: Partial<GraphEvaluationConfig['strategies'][K]>,
  ) => {
    setDraft((prev) => ({
      ...prev,
      strategies: {
        ...prev.strategies,
        [key]: { ...prev.strategies[key], ...patch },
      },
    }))
  }

  const updateCreation = <K extends keyof GraphEvaluationConfig['creation']>(
    key: K,
    patch: Partial<GraphEvaluationConfig['creation'][K]>,
  ) => {
    setDraft((prev) => ({
      ...prev,
      creation: {
        ...prev.creation,
        [key]: { ...prev.creation[key], ...patch },
      },
    }))
  }

  const handleSave = async () => {
    setIsSaving(true)
    setError(null)
    try {
      await updateGraphEvaluationSettingsClient(projectId, draft)
      onSaved()
      setSavedAt(Date.now())
      setTimeout(() => setSavedAt(null), 2500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings')
    } finally {
      setIsSaving(false)
    }
  }

  const handleRevert = () => {
    setDraft(config)
    setError(null)
  }

  const s = draft.strategies
  const c = draft.creation

  return (
    <div className="flex flex-col gap-8">
      {error && <Alert variant="warning">{error}</Alert>}

      {/* Matching strategies */}
      <section className="flex flex-col gap-3">
        <div>
          <Heading as="h4" size="label">Matching strategies</Heading>
          <p className="text-xs text-[color:var(--text-tertiary)] mt-1">
            Controls how this entity is linked to existing ones. Disable strategies that produce noise, or raise thresholds to require stronger matches.
          </p>
        </div>

        <div className="rounded-md border border-[color:var(--border-subtle)] overflow-hidden">
          <SemanticStrategyRow
            icon="🎙️"
            label="Sessions"
            description="Link to related sessions using semantic similarity"
            value={s.session}
            onChange={(patch) => updateStrategy('session', patch)}
          />
          <SemanticStrategyRow
            icon="🎯"
            label="Issues"
            description="Link to related issues using semantic similarity"
            value={s.issue}
            onChange={(patch) => updateStrategy('issue', patch)}
          />
          <SemanticStrategyRow
            icon="📚"
            label="Knowledge"
            description="Link to knowledge sources using semantic similarity"
            value={s.knowledge}
            onChange={(patch) => updateStrategy('knowledge', patch)}
          />
          <SemanticStrategyRow
            icon="👤"
            label="Contacts"
            description="Link to contacts using semantic similarity"
            value={s.contact}
            onChange={(patch) => updateStrategy('contact', patch)}
          />

          {/* Companies: two methods */}
          <StrategyRowShell icon="🏢" label="Companies" description="Link to companies using semantic match and/or substring text match on name/domain">
            <div className="flex flex-col gap-3">
              <SubRow
                label="Semantic match"
                enabled={s.company.semanticEnabled}
                onToggle={(v) => updateStrategy('company', { semanticEnabled: v })}
              >
                <ThresholdControl
                  value={s.company.semanticThreshold}
                  disabled={!s.company.semanticEnabled}
                  onChange={(v) => updateStrategy('company', { semanticThreshold: v })}
                />
              </SubRow>
              <SubRow
                label="Text fallback"
                enabled={s.company.textMatchEnabled}
                onToggle={(v) => updateStrategy('company', { textMatchEnabled: v })}
              >
                <label className="flex items-center gap-2 text-xs text-[color:var(--text-tertiary)]">
                  Min name length
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={s.company.textMatchMinNameLength}
                    disabled={!s.company.textMatchEnabled}
                    onChange={(e) =>
                      updateStrategy('company', { textMatchMinNameLength: Math.max(1, Math.min(20, parseInt(e.target.value, 10) || 1)) })
                    }
                    className="w-14 rounded border border-[color:var(--border-subtle)] bg-transparent px-2 py-1 text-sm text-[color:var(--foreground)] focus:border-[color:var(--accent-primary)] focus:outline-none disabled:opacity-50"
                  />
                </label>
              </SubRow>
            </div>
          </StrategyRowShell>

          {/* Product scope */}
          <StrategyRowShell
            icon="🧭"
            label="Product scope"
            description="Match to product scopes via topic text and optional LLM goal classification"
            isLast
          >
            <div className="flex flex-col gap-3">
              <SubRow
                label="Enabled"
                enabled={s.productScope.enabled}
                onToggle={(v) => updateStrategy('productScope', { enabled: v })}
              />
              <SubRow
                label="Require full-topic match"
                enabled={s.productScope.requireFullTopicMatch}
                onToggle={(v) => updateStrategy('productScope', { requireFullTopicMatch: v })}
                disabled={!s.productScope.enabled}
                hint="When on, a topic must be a substring of the scope's name/description/goals. When off, partial overlap with scope name also counts."
              />
              <SubRow
                label="LLM goal classification"
                enabled={s.productScope.llmClassification}
                onToggle={(v) => updateStrategy('productScope', { llmClassification: v })}
                disabled={!s.productScope.enabled}
                hint="Uses the configured LLM to pick the matching goal. Off = match the scope without goal reasoning (cheaper, less precise)."
              />
            </div>
          </StrategyRowShell>
        </div>
      </section>

      {/* Entity creation */}
      <section className="flex flex-col gap-3">
        <div>
          <Heading as="h4" size="label">Entity creation from feedback</Heading>
          <p className="text-xs text-[color:var(--text-tertiary)] mt-1">
            Only runs on sessions. Controls whether contacts and issues are created automatically from user feedback.
          </p>
        </div>

        <div className="rounded-md border border-[color:var(--border-subtle)] overflow-hidden">
          <StrategyRowShell icon="👤" label="Contact creation" description="Resolve the session's user by email and create a contact if none exists">
            <div className="flex items-center justify-between">
              <span className="text-sm text-[color:var(--foreground)]">Enabled</span>
              <ToggleSwitch
                checked={c.contacts.enabled}
                onChange={(v) => updateCreation('contacts', { enabled: v })}
              />
            </div>
          </StrategyRowShell>

          <StrategyRowShell
            icon="🎯"
            label="Issue creation"
            description="Auto-link to a similar existing issue or let the PM agent create a new one based on actionable tags"
            isLast
          >
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-[color:var(--foreground)]">Enabled</span>
                <ToggleSwitch
                  checked={c.issues.enabled}
                  onChange={(v) => updateCreation('issues', { enabled: v })}
                />
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex items-baseline justify-between">
                  <label className="text-xs text-[color:var(--text-tertiary)]">Auto-link to similar at</label>
                  <span className="text-xs font-medium text-[color:var(--foreground)] font-mono">
                    {formatThreshold(c.issues.linkThreshold)}
                  </span>
                </div>
                <Slider
                  min={THRESHOLD_MIN}
                  max={THRESHOLD_MAX}
                  step={THRESHOLD_STEP}
                  value={c.issues.linkThreshold}
                  onChange={(v) => updateCreation('issues', { linkThreshold: v })}
                  disabled={!c.issues.enabled}
                  showValue={false}
                  minLabel="Looser"
                  maxLabel="Stricter"
                />
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex items-baseline justify-between">
                  <label className="text-xs text-[color:var(--text-tertiary)]">Safety-net override at</label>
                  <span className="text-xs font-medium text-[color:var(--foreground)] font-mono">
                    {formatThreshold(c.issues.safetyNetThreshold)}
                  </span>
                </div>
                <Slider
                  min={THRESHOLD_MIN}
                  max={THRESHOLD_MAX}
                  step={THRESHOLD_STEP}
                  value={c.issues.safetyNetThreshold}
                  onChange={(v) => updateCreation('issues', { safetyNetThreshold: v })}
                  disabled={!c.issues.enabled}
                  showValue={false}
                  minLabel="Looser"
                  maxLabel="Stricter"
                />
                <p className="text-[10px] text-[color:var(--text-tertiary)]">
                  If the PM decides to create a new issue but a match above this threshold exists, link to it instead.
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs text-[color:var(--text-tertiary)]">Actionable tags</label>
                <ChipInput
                  values={c.issues.actionableTags}
                  onChange={(tags) => updateCreation('issues', { actionableTags: tags })}
                  placeholder="Add tag..."
                  disabled={!c.issues.enabled}
                />
                <p className="text-[10px] text-[color:var(--text-tertiary)]">
                  Issue creation is skipped unless the session has at least one of these tags.
                </p>
              </div>
            </div>
          </StrategyRowShell>
        </div>
      </section>

      <div className="flex items-center justify-end gap-3 border-t border-[color:var(--border-subtle)] pt-4">
        {savedAt && <span className="text-sm text-[color:var(--accent-success)]">Saved</span>}
        <Button variant="secondary" onClick={handleRevert} disabled={!isDirty || isSaving}>
          Revert
        </Button>
        <Button variant="primary" onClick={handleSave} loading={isSaving} disabled={!isDirty || isSaving}>
          Save
        </Button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Row components
// ---------------------------------------------------------------------------

interface SemanticStrategyRowProps {
  icon: string
  label: string
  description: string
  value: { enabled: boolean; threshold: number }
  onChange: (patch: Partial<{ enabled: boolean; threshold: number }>) => void
}

function SemanticStrategyRow({ icon, label, description, value, onChange }: SemanticStrategyRowProps) {
  return (
    <div className="flex items-center gap-3 border-b border-[color:var(--border-subtle)] px-4 py-3">
      <span className="text-xl shrink-0">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-[color:var(--foreground)]">{label}</div>
        <div className="text-xs text-[color:var(--text-secondary)]">{description}</div>
      </div>
      <div className="flex items-center gap-4 shrink-0">
        <ThresholdControl
          value={value.threshold}
          disabled={!value.enabled}
          onChange={(v) => onChange({ threshold: v })}
        />
        <ToggleSwitch checked={value.enabled} onChange={(v) => onChange({ enabled: v })} />
      </div>
    </div>
  )
}

interface StrategyRowShellProps {
  icon: string
  label: string
  description: string
  isLast?: boolean
  children: React.ReactNode
}

function StrategyRowShell({ icon, label, description, isLast, children }: StrategyRowShellProps) {
  return (
    <div className={`flex flex-col gap-3 px-4 py-3 ${isLast ? '' : 'border-b border-[color:var(--border-subtle)]'}`}>
      <div className="flex items-start gap-3">
        <span className="text-xl shrink-0">{icon}</span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-[color:var(--foreground)]">{label}</div>
          <div className="text-xs text-[color:var(--text-secondary)]">{description}</div>
        </div>
      </div>
      <div className="pl-9">{children}</div>
    </div>
  )
}

interface SubRowProps {
  label: string
  enabled: boolean
  onToggle: (v: boolean) => void
  disabled?: boolean
  hint?: string
  children?: React.ReactNode
}

function SubRow({ label, enabled, onToggle, disabled, hint, children }: SubRowProps) {
  return (
    <div className={`flex flex-col gap-1 ${disabled ? 'opacity-50' : ''}`}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-[color:var(--foreground)]">{label}</span>
        <div className="flex items-center gap-3 shrink-0">
          {children}
          <ToggleSwitch checked={enabled} onChange={onToggle} disabled={disabled} />
        </div>
      </div>
      {hint && <p className="text-[10px] text-[color:var(--text-tertiary)]">{hint}</p>}
    </div>
  )
}

function ThresholdControl({ value, disabled, onChange }: { value: number; disabled?: boolean; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-2 w-40">
      <Slider
        min={THRESHOLD_MIN}
        max={THRESHOLD_MAX}
        step={THRESHOLD_STEP}
        value={value}
        onChange={onChange}
        disabled={disabled}
        showValue={false}
      />
      <span className="text-xs font-medium text-[color:var(--foreground)] font-mono w-10 text-right">
        {formatThreshold(value)}
      </span>
    </div>
  )
}
