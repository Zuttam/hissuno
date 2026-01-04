'use client'

import { useState } from 'react'
import { FormField, Input, Button } from '@/components/ui'

interface ProjectKeysSectionProps {
  projectId: string
  secretKey: string | null
  onRotateKey: () => Promise<void>
  isRotating: boolean
}

export function ProjectKeysSection({
  projectId,
  secretKey,
  onRotateKey,
  isRotating,
}: ProjectKeysSectionProps) {
  const [showSecretKey, setShowSecretKey] = useState(false)

  return (
    <div>
      <h3 className="font-mono text-lg font-semibold uppercase tracking-tight text-[color:var(--foreground)] mb-4">
        Project Keys
      </h3>

      <div className="flex flex-col gap-4">
        <FormField
          label="Project ID"
          description="Use this ID to initialize the widget on your site."
        >
          <div className="flex items-center gap-2">
            <Input value={projectId} readOnly className="font-mono text-sm" />
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigator.clipboard.writeText(projectId)}
            >
              Copy
            </Button>
          </div>
        </FormField>

        <FormField
          label="Secret Key"
          description="Used to sign JWT tokens for widget authentication. Keep this secure."
        >
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <Input
                value={
                  showSecretKey && secretKey
                    ? secretKey
                    : '••••••••••••••••••••••••••••••••'
                }
                readOnly
                className="font-mono text-sm"
              />
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowSecretKey(!showSecretKey)}
            >
              {showSecretKey ? 'Hide' : 'Show'}
            </Button>
            {showSecretKey && secretKey && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => navigator.clipboard.writeText(secretKey)}
              >
                Copy
              </Button>
            )}
          </div>
        </FormField>

        <div className="pt-2">
          <Button
            variant="danger"
            size="sm"
            onClick={onRotateKey}
            disabled={isRotating}
          >
            {isRotating ? 'Rotating...' : 'Rotate Secret Key'}
          </Button>
          <p className="text-xs text-[color:var(--text-tertiary)] mt-2">
            Rotating the key will invalidate all existing JWT tokens. Update your
            backend after rotating.
          </p>
        </div>
      </div>
    </div>
  )
}
