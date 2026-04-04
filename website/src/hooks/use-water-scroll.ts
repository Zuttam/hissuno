'use client'

import { useRef, useMemo, useEffect, useState } from 'react'
import { useInView, useScroll, useTransform, useSpring, type MotionValue, type UseInViewOptions } from 'motion/react'
import {
  WATER_TRANSFORMS,
  WATER_EASINGS,
  WATER_TIMING,
  WATER_SPRINGS,
  type WaterPreset,
  type DurationType,
} from '@/components/landing/scroll-animation-config'

export interface UseWaterScrollOptions {
  /** Animation preset - determines intensity and style */
  preset?: WaterPreset
  /** Delay before animation starts (seconds) */
  delay?: number
  /** Animation duration (seconds) or duration preset */
  duration?: number | DurationType
  /** Enable parallax effect */
  parallax?: boolean
  /** Parallax depth multiplier (default 0.1) */
  parallaxDepth?: number
  /** Custom viewport options */
  viewport?: {
    once?: boolean
    amount?: number
    margin?: string
  }
}

export interface UseWaterScrollReturn {
  /** Ref to attach to the animated element */
  ref: React.RefObject<HTMLElement | null>
  /** Whether element is currently in view */
  isInView: boolean
  /** Motion props to spread onto motion.div */
  motionProps: {
    initial: Record<string, number>
    animate: Record<string, number>
    transition: {
      duration: number
      ease: readonly [number, number, number, number]
      delay: number
    }
  }
  /** Parallax Y value (MotionValue) - only if parallax enabled */
  parallaxY?: MotionValue<number>
  /** Whether reduced motion is preferred */
  prefersReducedMotion: boolean
}

/**
 * Premium water-drift scroll animation hook
 *
 * Features:
 * - Detects when element enters viewport
 * - Provides motion props with preset transforms
 * - Optional parallax effect
 * - Respects prefers-reduced-motion
 *
 * @example
 * ```tsx
 * const { ref, motionProps, isInView } = useWaterScroll({ preset: 'card', delay: 0.2 })
 * return <motion.div ref={ref} {...motionProps}>Content</motion.div>
 * ```
 */
export function useWaterScroll(options: UseWaterScrollOptions = {}): UseWaterScrollReturn {
  const {
    preset = 'section',
    delay = 0,
    duration,
    parallax = false,
    parallaxDepth = 0.1,
    viewport,
  } = options

  const ref = useRef<HTMLElement>(null)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

  // Check for reduced motion preference
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    setPrefersReducedMotion(mediaQuery.matches)

    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches)
    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [])

  // Viewport detection
  const viewportOptions = useMemo<UseInViewOptions>(
    () => ({
      once: viewport?.once ?? WATER_TIMING.viewport.once,
      amount: viewport?.amount ?? WATER_TIMING.viewport.amount,
      margin: (viewport?.margin ?? WATER_TIMING.viewport.margin) as UseInViewOptions['margin'],
    }),
    [viewport]
  )

  const isInView = useInView(ref, viewportOptions)

  // Get transform values for preset
  const transforms = WATER_TRANSFORMS[preset]

  // Resolve duration
  const resolvedDuration = useMemo(() => {
    if (typeof duration === 'number') return duration
    if (typeof duration === 'string') return WATER_TIMING.duration[duration]
    // Default durations based on preset
    switch (preset) {
      case 'hero':
        return WATER_TIMING.duration.hero
      case 'text':
        return WATER_TIMING.duration.fast
      default:
        return WATER_TIMING.duration.normal
    }
  }, [duration, preset])

  // Select easing based on preset
  const easing = preset === 'text' ? WATER_EASINGS.float : WATER_EASINGS.rise

  // Parallax setup
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  })

  const rawParallaxY = useTransform(scrollYProgress, [0, 1], [100 * parallaxDepth, -100 * parallaxDepth])

  const springParallaxY = useSpring(rawParallaxY, WATER_SPRINGS.parallax)

  // Build motion props
  const motionProps = useMemo(() => {
    if (prefersReducedMotion) {
      // Skip animation for reduced motion
      return {
        initial: transforms.final,
        animate: transforms.final,
        transition: { duration: 0, ease: easing, delay: 0 },
      }
    }

    return {
      initial: transforms.initial,
      animate: isInView ? transforms.final : transforms.initial,
      transition: {
        duration: resolvedDuration,
        ease: easing,
        delay,
      },
    }
  }, [prefersReducedMotion, transforms, isInView, resolvedDuration, easing, delay])

  return {
    ref,
    isInView,
    motionProps,
    parallaxY: parallax ? springParallaxY : undefined,
    prefersReducedMotion,
  }
}

/**
 * Calculate stagger delay for list items
 *
 * @example
 * ```tsx
 * {items.map((item, index) => (
 *   <WaterReveal delay={calculateStagger(index, 'organic')}>
 *     {item}
 *   </WaterReveal>
 * ))}
 * ```
 */
export function calculateStagger(
  index: number,
  stagger: 'tight' | 'normal' | 'loose' | 'organic' = 'normal'
): number {
  if (stagger === 'organic') {
    return WATER_TIMING.stagger.organic(index)
  }
  return index * WATER_TIMING.stagger[stagger]
}
