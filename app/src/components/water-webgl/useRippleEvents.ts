'use client'

import { useRef, useEffect, useId } from 'react'
import { useSpring } from 'motion/react'
import { useWaterWebGLOptional, type RippleEvent } from './WaterWebGLContext'

interface UseRippleEventsOptions {
  enabled?: boolean
  maxDistance?: number
  nudgeStrength?: number
  tiltStrength?: number
}

export function useRippleEvents(options: UseRippleEventsOptions = {}) {
  const {
    enabled = true,
    maxDistance = 600,
    nudgeStrength = 15,
    tiltStrength = 3,
  } = options

  const ref = useRef<HTMLElement>(null)
  const water = useWaterWebGLOptional()
  const componentId = useId()

  const nudgeX = useSpring(0, { stiffness: 150, damping: 15 })
  const nudgeY = useSpring(0, { stiffness: 150, damping: 15 })
  const tilt = useSpring(0, { stiffness: 200, damping: 20 })

  useEffect(() => {
    if (!enabled || !water || !ref.current) return

    const getRect = () => ref.current!.getBoundingClientRect()

    const handleRipple = (
      _event: RippleEvent,
      distance: number,
      angle: number
    ) => {
      const strength =
        Math.pow(1 - distance / maxDistance, 2) * (_event.strength ?? 1)

      nudgeX.set(Math.cos(angle) * strength * nudgeStrength)
      nudgeY.set(Math.sin(angle) * strength * nudgeStrength)
      tilt.set(strength * tiltStrength * (angle > 0 ? 1 : -1))

      setTimeout(() => {
        nudgeX.set(0)
        nudgeY.set(0)
        tilt.set(0)
      }, 800)
    }

    return water.subscribeToRipples(componentId, getRect, handleRipple)
  }, [
    enabled,
    water,
    componentId,
    maxDistance,
    nudgeStrength,
    tiltStrength,
    nudgeX,
    nudgeY,
    tilt,
  ])

  return {
    ref,
    motionValues: { nudgeX, nudgeY, tilt },
  }
}
