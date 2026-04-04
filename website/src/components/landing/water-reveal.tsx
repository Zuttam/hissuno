'use client'

import { forwardRef, useEffect, useRef, type ReactNode, type ComponentPropsWithoutRef } from 'react'
import { motion, type MotionProps } from 'motion/react'
import { useWaterScroll, calculateStagger } from '@/hooks/use-water-scroll'
import { useWaterWebGLOptional } from '@/components/water-webgl/WaterWebGLContext'
import type { WaterPreset, DurationType } from '@/components/landing/scroll-animation-config'

type StaggerType = 'tight' | 'normal' | 'loose' | 'organic'

export interface WaterRevealProps {
  /** Children to animate */
  children: ReactNode
  /** Animation preset - determines intensity and style */
  preset?: WaterPreset
  /** Base delay before animation starts (seconds) */
  delay?: number
  /** Animation duration (seconds) or duration preset */
  duration?: number | DurationType
  /** Enable parallax effect */
  parallax?: boolean
  /** Parallax depth multiplier (default 0.1) */
  parallaxDepth?: number
  /** Index for stagger calculation */
  staggerIndex?: number
  /** Stagger timing type */
  stagger?: StaggerType
  /** Element type to render */
  as?: 'div' | 'section' | 'article' | 'span' | 'li'
  /** Additional className */
  className?: string
  /** Additional motion props */
  motionProps?: Omit<MotionProps, 'initial' | 'animate' | 'transition' | 'style'>
  /** Additional style */
  style?: React.CSSProperties
  /** Trigger a ripple from center-bottom when element enters viewport */
  ripple?: boolean
  /** Ripple strength (0-1, default 0.5 for subtle effect) */
  rippleStrength?: number
}

/**
 * Convenience wrapper component for water-drift scroll animations
 *
 * @example
 * ```tsx
 * <WaterReveal preset="card" staggerIndex={index} stagger="organic">
 *   <FloatingCard>...</FloatingCard>
 * </WaterReveal>
 * ```
 *
 * @example
 * ```tsx
 * <WaterReveal preset="text" parallax ripple>
 *   <h2>Section Title</h2>
 * </WaterReveal>
 * ```
 */
export const WaterReveal = forwardRef<HTMLElement, WaterRevealProps>(function WaterReveal(
  {
    children,
    preset = 'section',
    delay = 0,
    duration,
    parallax = false,
    parallaxDepth = 0.1,
    staggerIndex,
    stagger = 'normal',
    as = 'div',
    className,
    motionProps: additionalMotionProps,
    style,
    ripple = false,
    rippleStrength = 0.5,
  },
  forwardedRef
) {
  // Calculate total delay including stagger
  const staggerDelay = staggerIndex !== undefined ? calculateStagger(staggerIndex, stagger) : 0
  const totalDelay = delay + staggerDelay

  const { ref, motionProps, parallaxY, prefersReducedMotion, isInView } = useWaterScroll({
    preset,
    delay: totalDelay,
    duration,
    parallax,
    parallaxDepth,
  })

  // Water WebGL for ripple effects
  const water = useWaterWebGLOptional()
  const hasTriggeredRipple = useRef(false)

  // Trigger wake effect when element enters viewport
  useEffect(() => {
    if (!ripple || !water || hasTriggeredRipple.current || !isInView || prefersReducedMotion) {
      return
    }

    const element = ref.current
    if (!element) return

    // Get element's bounding rect
    const rect = element.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const bottomY = rect.bottom

    // Base delay to sync with reveal animation
    const baseDelay = totalDelay * 1000 + 100

    // Create boat wake pattern: center first, then spreading outward
    const wakePoints = [
      { x: centerX, delay: 0, strength: rippleStrength * 0.6 },
      { x: centerX - rect.width * 0.25, delay: 60, strength: rippleStrength * 0.4 },
      { x: centerX + rect.width * 0.25, delay: 60, strength: rippleStrength * 0.4 },
      { x: centerX - rect.width * 0.45, delay: 120, strength: rippleStrength * 0.25 },
      { x: centerX + rect.width * 0.45, delay: 120, strength: rippleStrength * 0.25 },
    ]

    wakePoints.forEach(({ x, delay, strength }) => {
      setTimeout(() => {
        water.triggerRipple(x, bottomY, strength)
      }, baseDelay + delay)
    })

    hasTriggeredRipple.current = true
  }, [isInView, ripple, water, prefersReducedMotion, rippleStrength, totalDelay, ref])

  // Merge refs
  const mergedRef = (node: HTMLElement | null) => {
    // Update internal ref
    ;(ref as React.MutableRefObject<HTMLElement | null>).current = node

    // Update forwarded ref
    if (typeof forwardedRef === 'function') {
      forwardedRef(node)
    } else if (forwardedRef) {
      ;(forwardedRef as React.MutableRefObject<HTMLElement | null>).current = node
    }
  }

  // Build combined style with parallax
  const combinedStyle: React.CSSProperties = {
    ...style,
    ...(parallax && parallaxY && !prefersReducedMotion
      ? { y: parallaxY as unknown as number }
      : {}),
  }

  // Get the motion component for the element type
  const MotionComponent = motion[as] as React.ComponentType<
    ComponentPropsWithoutRef<typeof motion.div> & { ref?: React.Ref<HTMLElement> }
  >

  return (
    <MotionComponent
      ref={mergedRef}
      className={className}
      style={combinedStyle}
      {...motionProps}
      {...additionalMotionProps}
    >
      {children}
    </MotionComponent>
  )
})

WaterReveal.displayName = 'WaterReveal'

export { WaterReveal as default }
