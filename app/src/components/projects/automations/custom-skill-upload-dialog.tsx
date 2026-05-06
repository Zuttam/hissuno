'use client'

import { useCallback, useState } from 'react'
import { Upload } from 'lucide-react'
import { Button, Dialog, FormField, InlineAlert, Input, Textarea } from '@/components/ui'

interface Props {
  open: boolean
  projectId: string
  onCloseAction: () => void
  onUploadedAction: () => void
}

export function CustomSkillUploadDialog({ open, projectId, onCloseAction, onUploadedAction }: Props) {
  const [skillId, setSkillId] = useState('')
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFile = useCallback((file: File | null) => {
    if (!file) return
    void file.text().then((text) => setContent(text))
    if (!skillId) {
      const base = file.name.replace(/\.md$/i, '').toLowerCase().replace(/[^a-z0-9-]/g, '-')
      setSkillId(base.replace(/^-+|-+$/g, ''))
    }
  }, [skillId])

  const handleSubmit = async () => {
    if (!skillId.trim() || !content.trim()) {
      setError('skillId and SKILL.md content are required.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/automations/custom?projectId=${projectId}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ skillId: skillId.trim(), content }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error ?? 'Upload failed')
      }
      onUploadedAction()
      onCloseAction()
      setSkillId('')
      setContent('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onClose={onCloseAction} title="Upload custom skill" size="md">
      <div className="flex flex-col gap-4">
        {error && <InlineAlert variant="danger">{error}</InlineAlert>}

        <FormField label="Skill ID" supportingText="kebab-case identifier, e.g. my-custom-skill">
          <Input
            type="text"
            value={skillId}
            onChange={(e) => setSkillId(e.target.value)}
            placeholder="my-custom-skill"
          />
        </FormField>

        <FormField label="SKILL.md file">
          <Input
            type="file"
            accept=".md,text/markdown,text/plain"
            onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
          />
        </FormField>

        <FormField label="Content" supportingText="Or paste the SKILL.md contents directly.">
          <Textarea
            rows={10}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="---&#10;name: My Skill&#10;description: ...&#10;---&#10;&#10;# Skill body"
          />
        </FormField>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" size="sm" onClick={onCloseAction} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={handleSubmit} loading={submitting}>
            <Upload size={14} />
            Upload
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
