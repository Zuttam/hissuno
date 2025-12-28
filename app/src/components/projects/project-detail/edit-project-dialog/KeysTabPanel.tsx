'use client'

import { Button, KeyField } from '@/components/ui'

interface KeysTabPanelProps {
  publicKey: string
  secretKey: string
  isRotating: 'public' | 'secret' | 'both' | null
  onRotateKeys: (keyType: 'public' | 'secret' | 'both') => void
}

export function KeysTabPanel({
  publicKey,
  secretKey,
  isRotating,
  onRotateKeys,
}: KeysTabPanelProps) {
  return (
    <div className="flex flex-col gap-10">
      <KeyField
        label="Public Key"
        value={publicKey || 'Not generated'}
        description="Safe to use in frontend code"
        descriptionVariant="success"
        disabled={!publicKey}
      />

      <KeyField
        label="Secret Key"
        value={secretKey || 'Not generated'}
        description="Keep this secret! Never expose in frontend"
        descriptionVariant="warning"
        isSecret
        disabled={!secretKey}
      />

      <div className="border-t border-slate-200 dark:border-slate-700 pt-6">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-4">
          Rotate Keys
        </h4>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
          Rotating a key will invalidate the old key immediately. Make sure to update your integrations.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={() => onRotateKeys('public')}
            disabled={isRotating !== null}
          >
            {isRotating === 'public' ? 'Rotating...' : 'Rotate Public Key'}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => onRotateKeys('secret')}
            disabled={isRotating !== null}
          >
            {isRotating === 'secret' ? 'Rotating...' : 'Rotate Secret Key'}
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={() => onRotateKeys('both')}
            disabled={isRotating !== null}
          >
            {isRotating === 'both' ? 'Rotating...' : 'Rotate Both Keys'}
          </Button>
        </div>
      </div>
    </div>
  )
}
