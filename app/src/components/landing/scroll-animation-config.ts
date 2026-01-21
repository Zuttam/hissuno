/**
 * Premium water-drift scroll animation configuration
 * Inspired by Japanese onsen - smooth, buttery, organic movement
 */

// Premium underwater easing - buoyancy effect with slight overshoot
export const WATER_EASINGS = {
  rise: [0.23, 0.91, 0.32, 1.15] as const, // Primary reveal with overshoot
  float: [0.25, 0.46, 0.45, 0.94] as const, // Text (no overshoot, smoother)
} as const

// Transform presets for different element types
export const WATER_TRANSFORMS = {
  section: {
    initial: { y: 60, opacity: 0, rotateX: 4 },
    final: { y: 0, opacity: 1, rotateX: 0 },
  },
  card: {
    initial: { y: 40, opacity: 0, rotateX: 2, scale: 0.98 },
    final: { y: 0, opacity: 1, rotateX: 0, scale: 1 },
  },
  text: {
    initial: { y: 20, opacity: 0 },
    final: { y: 0, opacity: 1 },
  },
  hero: {
    initial: { y: 80, opacity: 0, rotateX: 6 },
    final: { y: 0, opacity: 1, rotateX: 0 },
  },
} as const

// Timing configuration
export const WATER_TIMING = {
  duration: {
    fast: 0.6,
    normal: 0.8,
    slow: 1.0,
    hero: 1.2,
  },
  stagger: {
    tight: 0.08,
    normal: 0.12,
    loose: 0.18,
    // Organic stagger adds randomness for natural feel
    organic: (index: number) => index * 0.1 + Math.random() * 0.06,
  },
  viewport: {
    once: true,
    amount: 0.2,
    margin: '-50px',
  },
} as const

// Spring configurations for physics-based animations
export const WATER_SPRINGS = {
  reveal: { stiffness: 100, damping: 18, mass: 1 },
  parallax: { stiffness: 40, damping: 20 },
} as const

// Preset types
export type WaterPreset = keyof typeof WATER_TRANSFORMS
export type StaggerType = keyof typeof WATER_TIMING.stagger
export type DurationType = keyof typeof WATER_TIMING.duration
