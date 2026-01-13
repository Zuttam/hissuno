'use client'

import {
  useRef,
  useEffect,
  useId,
  type ReactNode,
} from 'react'
import { motion, useSpring, useTransform } from 'motion/react'
import { cn } from '@/lib/utils/class'
import {
  useWaterWebGLOptional,
  type RippleEvent,
} from '@/components/water-webgl/WaterWebGLContext'
import { cardBaseClasses } from './card'

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
  default: {
    base: '0 4px 12px rgba(0, 0, 0, 0.08), 0 2px 4px rgba(0, 0, 0, 0.04)',
    hover: '0 8px 24px rgba(0, 0, 0, 0.12), 0 4px 8px rgba(0, 0, 0, 0.06)',
  },
  elevated: {
    base: '0 8px 16px rgba(0, 0, 0, 0.06), 0 16px 32px rgba(0, 0, 0, 0.08), 0 32px 64px rgba(0, 0, 0, 0.10), 0 2px 4px rgba(0, 0, 0, 0.04)',
    hover: '0 12px 24px rgba(0, 0, 0, 0.08), 0 24px 48px rgba(0, 0, 0, 0.10), 0 48px 96px rgba(0, 0, 0, 0.12), 0 2px 4px rgba(0, 0, 0, 0.04)',
  },
} as const

interface FloatingCardProps {
  children?: ReactNode
  className?: string
  /** Optional inline styles */
  style?: React.CSSProperties
  /** Controls the ambient floating animation intensity */
  floating?: FloatingPreset
  /** Controls the shadow depth appearance */
  variant?: FloatingCardVariant
  /** Controls whether the card responds to ripple events */
  respondToRipple?: boolean
}

export function FloatingCard({
  children,
  className,
  style,
  floating = 'gentle',
  variant = 'elevated',
  respondToRipple = false,
}: FloatingCardProps) {
  const ref = useRef<HTMLElement>(null)
  const water = useWaterWebGLOptional()
  const componentId = useId()

  // Resolve floating preset (handle boolean for backward compatibility)
  const resolvedFloating: 'none' | 'gentle' | 'moderate' | 'active' =
    floating === true ? 'moderate' : floating === false ? 'none' : floating

  // Spring-animated motion values for ripple response
  const nudgeX = useSpring(0, { stiffness: 150, damping: 15 })
  const nudgeY = useSpring(0, { stiffness: 150, damping: 15 })
  const tilt = useSpring(0, { stiffness: 200, damping: 20 })

  // Ambient floating springs (separate from ripple response)
  const driftX = useSpring(0, { stiffness: 80, damping: 12 })
  const driftY = useSpring(0, { stiffness: 80, damping: 12 })

  // Combine ripple nudge with ambient drift
  const combinedX = useTransform(
    [nudgeX, driftX],
    ([nudge, drift]) => (nudge as number) + (drift as number)
  )
  const combinedY = useTransform(
    [nudgeY, driftY],
    ([nudge, drift]) => (nudge as number) + (drift as number)
  )

  // Ambient floating animation
  useEffect(() => {
    // If floating is disabled, ensure drift values are zero and exit
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

      // Horizontal sway
      const xValue =
        Math.sin(t * config.xFrequency * Math.PI * 2 + offset) *
        config.xAmplitude

      // Vertical bob with phase offset for organic movement
      const yValue =
        Math.sin(
          t * config.yFrequency * Math.PI * 2 + offset + config.phaseOffset
        ) * config.yAmplitude

      driftX.set(xValue)
      driftY.set(yValue)
      frame = requestAnimationFrame(animate)
    }
    animate()

    return () => cancelAnimationFrame(frame)
  }, [resolvedFloating, driftX, driftY])

  // Subscribe to ripple events
  useEffect(() => {
    if (!respondToRipple || !water || !ref.current) return

    const getRect = () => ref.current!.getBoundingClientRect()

    const handleRipple = (
      _event: RippleEvent,
      distance: number,
      angle: number
    ) => {
      // Calculate nudge based on distance (closer = stronger)
      const maxDistance = 600
      const strength = Math.pow(1 - distance / maxDistance, 2)

      // Push away from ripple origin
      const pushX = Math.cos(angle) * strength * 30
      const pushY = Math.sin(angle) * strength * 30
      const tiltAmount = strength * 5 * (angle > 0 ? 1 : -1)

      nudgeX.set(pushX)
      nudgeY.set(pushY)
      tilt.set(tiltAmount)

      // Return to neutral after delay
      setTimeout(() => {
        nudgeX.set(0)
        nudgeY.set(0)
        tilt.set(0)
      }, 800)
    }

    return water.subscribeToRipples(componentId, getRect, handleRipple)
  }, [respondToRipple, water, componentId, nudgeX, nudgeY, tilt])

  // Get shadow config based on variant
  const shadowConfig = SHADOW_CONFIGS[variant]

  return (
    <motion.section
      ref={ref as React.RefObject<HTMLElement>}
      className={cn(cardBaseClasses, className)}
      data-no-ripple
      style={{
        ...style,
        x: combinedX,
        y: combinedY,
        rotate: tilt,
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
