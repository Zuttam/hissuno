'use client'

import { type ReactNode } from 'react'
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
  children,
}: StepRevealWrapperProps) {
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
  // The wizard "Continue" button (in WizardContainer) will call onRevealComplete
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
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
