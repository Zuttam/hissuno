'use client'

import { type ReactNode, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import type { OnboardingStepId, StepRevealConfig } from './types'

interface StepRevealWrapperProps {
  stepId: OnboardingStepId
  revealConfig: StepRevealConfig
  isRevealed: boolean
  onRevealComplete: (stepId: OnboardingStepId) => void
  children: ReactNode
}

export function StepRevealWrapper({
  stepId,
  revealConfig,
  isRevealed,
  onRevealComplete,
  children,
}: StepRevealWrapperProps) {
  const handleReveal = useCallback(() => {
    onRevealComplete(stepId)
  }, [onRevealComplete, stepId])

  // Listen for Enter key to dismiss reveal
  useEffect(() => {
    if (isRevealed) return

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Enter') {
        e.preventDefault()
        handleReveal()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isRevealed, handleReveal])

  // Already revealed — render children directly with a subtle enter animation
  if (isRevealed) {
    return (
      <motion.div
        key={`${stepId}-ready`}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
      >
        {children}
      </motion.div>
    )
  }

  // Not yet revealed — show the cinematic reveal message
  // The wizard "Continue" button (in WizardContainer) or Enter key will call onRevealComplete
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={`${stepId}-reveal`}
        className="flex min-h-[320px] items-center justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0, y: -12 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        <div className="mx-auto max-w-lg text-center">
          <motion.p
            className="font-mono text-lg leading-relaxed text-[var(--foreground)] sm:text-xl"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15, ease: 'easeOut' }}
          >
            {revealConfig.message}
          </motion.p>

          {revealConfig.subtitle && (
            <motion.p
              className="mt-4 text-sm text-[var(--text-secondary)]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.4 }}
            >
              {revealConfig.subtitle}
            </motion.p>
          )}

          {/* "Press Enter" hint — fades in after 1s */}
          <motion.p
            className="mt-8 text-xs text-[var(--text-tertiary)]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 1 }}
          >
            Press Enter to continue
          </motion.p>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
