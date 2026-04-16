'use client'

import { useRef, useEffect, type ReactNode } from 'react'
import { motion, useSpring } from 'motion/react'
import { cn } from '@/lib/utils/class'
import { cardBaseClasses } from './card'
import { useThemePreference } from '@/hooks/use-theme-preference'

// Floating preset type - controls ambient drift behavior
export type FloatingPreset = 'none' | 'gentle' | 'moderate' | 'active' | boolean

// Card variant type - controls shadow depth appearance
export type FloatingCardVariant = 'default' | 'elevated'

// Floating preset configurations
const FLOATING_PRESETS = {
  gentle: {
    xFrequency: 0.2,
    yFrequency: 0.3,
    xAmplitude: 1.1,
    yAmplitude: 1.1,
    phaseOffset: Math.PI / 3,
  },
  moderate: {
    xFrequency: 0.4,
    yFrequency: 0.5,
    xAmplitude: 2.5,
    yAmplitude: 2,
    phaseOffset: Math.PI / 4,
  },
  active: {
    xFrequency: 0.6,
    yFrequency: 0.7,
    xAmplitude: 4,
    yAmplitude: 3,
    phaseOffset: Math.PI / 5,
  },
} as const

// Shadow configurations for each variant
const SHADOW_CONFIGS = {
  light: {
    default: {
      base: '0 4px 12px rgba(45, 80, 75, 0.06), 0 2px 4px rgba(45, 80, 75, 0.03)',
      hover: '0 8px 24px rgba(45, 80, 75, 0.10), 0 4px 8px rgba(45, 80, 75, 0.05)',
    },
    elevated: {
      base: '0 8px 16px rgba(45, 80, 75, 0.05), 0 16px 32px rgba(45, 80, 75, 0.06), 0 2px 4px rgba(45, 80, 75, 0.03)',
      hover: '0 12px 24px rgba(45, 80, 75, 0.08), 0 24px 48px rgba(45, 80, 75, 0.08), 0 2px 4px rgba(45, 80, 75, 0.03)',
    },
  },
  dark: {
    default: {
      base: '0 4px 12px rgba(0, 0, 0, 0.08), 0 2px 4px rgba(0, 0, 0, 0.04)',
      hover: '0 8px 24px rgba(0, 0, 0, 0.12), 0 4px 8px rgba(0, 0, 0, 0.06)',
    },
    elevated: {
      base: [
        '0 1px 2px rgba(0, 0, 0, 0.3)',
        '0 4px 8px rgba(0, 0, 0, 0.25)',
        '0 12px 24px rgba(0, 0, 0, 0.25)',
        '0 24px 48px rgba(0, 0, 0, 0.20)',
        'inset 0 1px 0 rgba(255, 255, 255, 0.03)',
      ].join(', '),
      hover: [
        '0 2px 4px rgba(0, 0, 0, 0.3)',
        '0 8px 16px rgba(0, 0, 0, 0.28)',
        '0 20px 40px rgba(0, 0, 0, 0.28)',
        '0 40px 80px rgba(0, 0, 0, 0.22)',
        'inset 0 1px 0 rgba(255, 255, 255, 0.05)',
      ].join(', '),
    },
  },
} as const

interface FloatingCardProps {
  children?: ReactNode
  className?: string
  style?: React.CSSProperties
  floating?: FloatingPreset
  variant?: FloatingCardVariant
}

export function FloatingCard({
  children,
  className,
  style,
  floating = 'gentle',
  variant = 'elevated',
}: FloatingCardProps) {
  const ref = useRef<HTMLElement>(null)
  const { resolvedTheme } = useThemePreference()
  const isDarkMode = resolvedTheme === 'dark'

  const resolvedFloating: 'none' | 'gentle' | 'moderate' | 'active' =
    floating === true ? 'moderate' : floating === false ? 'none' : floating

  const driftX = useSpring(0, { stiffness: 80, damping: 12 })
  const driftY = useSpring(0, { stiffness: 80, damping: 12 })

  useEffect(() => {
    if (resolvedFloating === 'none') {
      driftX.set(0)
      driftY.set(0)
      return
    }

    const config = FLOATING_PRESETS[resolvedFloating]
    const offset = Math.random() * Math.PI * 2
    let frame: number

    const animate = () => {
      const t = Date.now() / 1000
      driftX.set(Math.sin(t * config.xFrequency * Math.PI * 2 + offset) * config.xAmplitude)
      driftY.set(Math.sin(t * config.yFrequency * Math.PI * 2 + offset + config.phaseOffset) * config.yAmplitude)
      frame = requestAnimationFrame(animate)
    }
    animate()

    return () => cancelAnimationFrame(frame)
  }, [resolvedFloating, driftX, driftY])

  const themeConfig = isDarkMode ? SHADOW_CONFIGS.dark : SHADOW_CONFIGS.light
  const shadowConfig = themeConfig[variant]

  return (
    <motion.section
      ref={ref as React.RefObject<HTMLElement>}
      className={cn(cardBaseClasses, className)}
      style={{
        ...style,
        x: driftX,
        y: driftY,
        boxShadow: shadowConfig.base,
      }}
      whileHover={{
        boxShadow: shadowConfig.hover,
      }}
    >
      {children}
    </motion.section>
  )
}
