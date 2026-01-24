---
status: pending
created: 2026-01-21
impact: high
summary: Transform marketing page light mode into Japanese onsen atmosphere with mist, enhanced water effects, and warm color palette
---

# Marketing Page Light Mode Enhancement - Two Approaches

**Goal:** Make the light mode marketing page feel like a Japanese onsen with gentle ambient life — soft gradients, misty atmosphere, and purposeful ripple responses.

**Current State:** The page has WebGL water ripples but they're barely visible in light mode (`--water-opacity: 0.3`). The palette is neutral (`#fafafa` background, `#666` text) and lacks the onsen atmosphere.

---

# Plan A: Atmospheric Layers

**Approach:** Enhance existing components with atmospheric overlays and refined color palette. Lower effort, builds on current architecture.

---

## Task A1: Onsen Color Palette for Light Mode

**Files:**
- Modify: `app/src/app/globals.css:37-45` (light mode water variables)
- Modify: `app/src/app/globals.css:9-31` (light mode theme variables)

**Changes:**

Update light mode CSS variables to warm stone/onsen palette:

```css
:root {
  /* Warm stone background instead of stark white */
  --background: #f7f5f2;
  --foreground: #2d2a26;

  /* Softer borders */
  --border: #e8e4df;
  --border-subtle: #f0ece7;

  /* Muted secondary text */
  --text-secondary: #7a756d;

  /* Water variables - more visible, onsen-inspired */
  --water-base: #e8f4f3;           /* Soft mineral water tint */
  --water-deep: #c5e4e1;           /* Deeper teal for caustics */
  --water-ripple: #ffffff;
  --water-opacity: 0.55;           /* More visible (was 0.3) */
  --water-ripple-intensity: 5.0;   /* Stronger ripples (was 4.0) */
  --water-caustic: #a8d8d4;        /* Visible teal caustics */
  --water-caustic-intensity: 1.4;  /* More prominent (was 1.0) */
  --water-caustic-sharpness: 0.45; /* Slightly sharper (was 0.6) */
  --water-background: #f7f5f2;     /* Match new background */
}
```

**Verification:** Toggle to light mode, caustics and ripples should be noticeably more visible with a warm, mineral-water tint.

---

## Task A2: Mist Overlay Component

**Files:**
- Create: `app/src/components/landing/home/mist-overlay.tsx`
- Modify: `app/src/app/(marketing)/page.tsx`

**Create mist overlay with drifting gradients:**

```tsx
'use client'

import { motion } from 'motion/react'

export function MistOverlay() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
      {/* Layer 1: Slow drift from left */}
      <motion.div
        className="absolute -left-1/4 top-0 h-full w-[150%] opacity-30"
        style={{
          background: 'radial-gradient(ellipse 80% 50% at 30% 50%, rgba(200, 220, 218, 0.6) 0%, transparent 70%)',
        }}
        animate={{
          x: ['0%', '10%', '0%'],
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
      {/* Layer 2: Slow drift from right */}
      <motion.div
        className="absolute -right-1/4 top-0 h-full w-[150%] opacity-20"
        style={{
          background: 'radial-gradient(ellipse 60% 40% at 70% 60%, rgba(180, 210, 205, 0.5) 0%, transparent 60%)',
        }}
        animate={{
          x: ['0%', '-8%', '0%'],
        }}
        transition={{
          duration: 25,
          repeat: Infinity,
          ease: 'easeInOut',
          delay: 5,
        }}
      />
      {/* Layer 3: Top mist band */}
      <motion.div
        className="absolute left-0 top-0 h-64 w-full opacity-40"
        style={{
          background: 'linear-gradient(to bottom, rgba(247, 245, 242, 0.9) 0%, transparent 100%)',
        }}
        animate={{
          opacity: [0.4, 0.5, 0.4],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
    </div>
  )
}
```

**Add to page.tsx:**

```tsx
import { MistOverlay } from '@/components/landing/home/mist-overlay'

// In the component, after UTMCapture:
<MistOverlay />
```

**Verification:** Subtle cloud-like shapes should drift slowly across the viewport.

---

## Task A3: Enhanced FloatingCard Styling

**Files:**
- Modify: `app/src/components/ui/floating-card.tsx`
- Modify: `app/src/app/globals.css`

**Add onsen-specific card styling:**

In `globals.css`, add new CSS variables for light mode:

```css
:root {
  /* ... existing ... */
  --card-bg: rgba(255, 255, 255, 0.7);
  --card-border: rgba(200, 215, 210, 0.4);
  --card-shadow: 0 8px 32px rgba(45, 80, 75, 0.08);
}
```

In `floating-card.tsx`, update shadow configs for light mode awareness:

```tsx
// Add theme-aware shadow config
const SHADOW_CONFIGS = {
  default: {
    base: '0 4px 12px rgba(45, 80, 75, 0.06), 0 2px 4px rgba(45, 80, 75, 0.03)',
    hover: '0 8px 24px rgba(45, 80, 75, 0.10), 0 4px 8px rgba(45, 80, 75, 0.05)',
  },
  elevated: {
    base: '0 8px 16px rgba(45, 80, 75, 0.05), 0 16px 32px rgba(45, 80, 75, 0.06), 0 2px 4px rgba(45, 80, 75, 0.03)',
    hover: '0 12px 24px rgba(45, 80, 75, 0.08), 0 24px 48px rgba(45, 80, 75, 0.08), 0 2px 4px rgba(45, 80, 75, 0.03)',
  },
}
```

**Verification:** Cards should have a softer, warmer shadow with subtle green-gray tint.

---

## Task A4: Hero Section Atmosphere

**Files:**
- Modify: `app/src/components/landing/home/hero-section.tsx`

**Add atmospheric gradient behind hero content:**

```tsx
// Add after the opening <section> tag:
<div
  className="pointer-events-none absolute inset-0 opacity-60"
  style={{
    background: 'radial-gradient(ellipse 100% 80% at 50% 20%, rgba(200, 228, 225, 0.4) 0%, transparent 60%)',
  }}
/>
```

**Verification:** Hero should have a soft teal glow emanating from the top center.

---

## Task A5: Section Dividers with Organic Shapes

**Files:**
- Create: `app/src/components/landing/home/section-divider.tsx`
- Modify: `app/src/app/(marketing)/page.tsx`

**Create organic wave divider:**

```tsx
export function SectionDivider({ flip = false }: { flip?: boolean }) {
  return (
    <div
      className={`relative h-16 w-full overflow-hidden ${flip ? 'rotate-180' : ''}`}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 1440 64"
        fill="none"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full"
      >
        <path
          d="M0 32C240 48 480 16 720 32C960 48 1200 16 1440 32V64H0V32Z"
          fill="currentColor"
          className="text-[var(--background)] opacity-50"
        />
      </svg>
    </div>
  )
}
```

**Verification:** Subtle wave shapes should appear between sections.

---

# Plan B: Immersive Onsen Scene

**Approach:** Transform the hero into an immersive onsen scene with steam particles, enhanced water surface, and cohesive zen aesthetic throughout. Higher effort, more distinctive result.

---

## Task B1: Onsen Color Palette (Same as A1)

**Files:**
- Modify: `app/src/app/globals.css:37-45`
- Modify: `app/src/app/globals.css:9-31`

*(Same changes as Plan A Task A1)*

---

## Task B2: Steam Particles Component

**Files:**
- Create: `app/src/components/landing/home/steam-particles.tsx`
- Modify: `app/src/app/(marketing)/page.tsx`

**Create rising steam particles that respond to mouse:**

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, useMotionValue, useSpring } from 'motion/react'

interface Particle {
  id: number
  x: number
  y: number
  size: number
  duration: number
  delay: number
}

export function SteamParticles() {
  const [particles, setParticles] = useState<Particle[]>([])
  const containerRef = useRef<HTMLDivElement>(null)
  const mouseX = useMotionValue(0.5)
  const mouseY = useMotionValue(0.5)
  const smoothMouseX = useSpring(mouseX, { stiffness: 50, damping: 20 })
  const smoothMouseY = useSpring(mouseY, { stiffness: 50, damping: 20 })

  // Generate particles on mount
  useEffect(() => {
    const newParticles: Particle[] = Array.from({ length: 20 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: 80 + Math.random() * 20, // Start near bottom
      size: 60 + Math.random() * 100,
      duration: 15 + Math.random() * 10,
      delay: Math.random() * 10,
    }))
    setParticles(newParticles)
  }, [])

  // Track mouse position
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mouseX.set(e.clientX / window.innerWidth)
      mouseY.set(e.clientY / window.innerHeight)
    }
    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [mouseX, mouseY])

  return (
    <div
      ref={containerRef}
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      aria-hidden="true"
    >
      {particles.map((particle) => (
        <motion.div
          key={particle.id}
          className="absolute rounded-full"
          style={{
            width: particle.size,
            height: particle.size,
            left: `${particle.x}%`,
            background: 'radial-gradient(circle, rgba(255,255,255,0.15) 0%, transparent 70%)',
            filter: 'blur(20px)',
            x: smoothMouseX.get() * 30 - 15,
          }}
          initial={{ y: '100vh', opacity: 0 }}
          animate={{
            y: [100, -particle.size],
            opacity: [0, 0.4, 0.3, 0],
            scale: [0.8, 1.2, 1.5],
          }}
          transition={{
            duration: particle.duration,
            delay: particle.delay,
            repeat: Infinity,
            ease: 'easeOut',
          }}
        />
      ))}
    </div>
  )
}
```

**Verification:** Soft white particles should rise slowly from bottom, drifting slightly with mouse movement.

---

## Task B3: Water Surface Gradient Background

**Files:**
- Modify: `app/src/app/(marketing)/layout.tsx`
- Modify: `app/src/app/globals.css`

**Add water surface gradient to layout:**

In `globals.css`, add:

```css
:root {
  /* ... existing ... */
  --water-surface-gradient: radial-gradient(
    ellipse 150% 100% at 50% 100%,
    rgba(200, 228, 225, 0.5) 0%,
    rgba(220, 238, 235, 0.3) 30%,
    transparent 70%
  );
}

.dark {
  --water-surface-gradient: none;
}
```

In `layout.tsx`, wrap content with gradient overlay:

```tsx
<main className="relative pt-16">
  {/* Water surface gradient - light mode only */}
  <div
    className="pointer-events-none fixed inset-0 z-0 dark:hidden"
    style={{ background: 'var(--water-surface-gradient)' }}
    aria-hidden="true"
  />
  {children}
</main>
```

**Verification:** Looking at the page should feel like looking down at calm water surface with light reflecting from below.

---

## Task B4: Immersive Hero Redesign

**Files:**
- Modify: `app/src/components/landing/home/hero-section.tsx`

**Redesign hero with zen atmosphere:**

```tsx
'use client'

import { motion } from 'motion/react'
import { Button, ThemeLogo } from '@/components/ui'
import { useWaterWebGLOptional } from '@/components/water-webgl/WaterWebGLContext'
import { useCTA } from '@/components/landing/cta-context'

export function HeroSection() {
  const water = useWaterWebGLOptional()
  const { openCTAOptions } = useCTA()

  const handleLogoClick = (e: React.MouseEvent) => {
    water?.triggerRipple(e.clientX, e.clientY, 1.5)
  }

  const handleCTAClick = (e: React.MouseEvent) => {
    water?.triggerRipple(e.clientX, e.clientY, 2.0) // Larger ripple
    openCTAOptions('hero')
  }

  return (
    <section className="relative overflow-hidden px-6 py-12 md:px-12 md:py-20">
      {/* Atmospheric glow layers */}
      <div className="pointer-events-none absolute inset-0">
        {/* Central warm glow */}
        <div
          className="absolute left-1/2 top-1/3 h-[600px] w-[800px] -translate-x-1/2 -translate-y-1/2 opacity-40 dark:opacity-20"
          style={{
            background: 'radial-gradient(ellipse, rgba(200, 228, 225, 0.6) 0%, transparent 60%)',
            filter: 'blur(60px)',
          }}
        />
        {/* Subtle side accents */}
        <div
          className="absolute left-0 top-1/4 h-[400px] w-[300px] opacity-20"
          style={{
            background: 'radial-gradient(ellipse, rgba(180, 210, 205, 0.5) 0%, transparent 70%)',
            filter: 'blur(40px)',
          }}
        />
        <div
          className="absolute right-0 top-1/3 h-[350px] w-[250px] opacity-20"
          style={{
            background: 'radial-gradient(ellipse, rgba(190, 215, 210, 0.5) 0%, transparent 70%)',
            filter: 'blur(40px)',
          }}
        />
      </div>

      <div className="relative z-10 mx-auto max-w-4xl text-center">
        {/* Logo with enhanced ripple feedback */}
        <motion.div
          className="mx-auto mb-10 w-fit cursor-pointer"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleLogoClick}
        >
          <ThemeLogo width={200} height={70} priority />
        </motion.div>

        {/* Headline with staggered animation */}
        <motion.h1
          className="font-mono text-4xl font-bold tracking-tight text-[var(--foreground)] md:text-6xl"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        >
          Turn Customer Conversations into
          <motion.span
            className="block bg-gradient-to-r from-[var(--accent-teal)] to-[var(--accent-selected)] bg-clip-text text-transparent"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: 'easeOut' }}
          >
            Engineering Work
          </motion.span>
        </motion.h1>

        <motion.p
          className="mx-auto mt-8 max-w-2xl text-lg text-[var(--text-secondary)] md:text-xl"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4, ease: 'easeOut' }}
        >
          Hissuno is an AI-powered customer intelligence platform that turns customer conversations
          into actionable issues, product specs, and shipped code — without the tool sprawl.
        </motion.p>

        <motion.div
          className="mt-12 flex flex-col items-center justify-center gap-4 sm:flex-row"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6, ease: 'easeOut' }}
        >
          <Button
            size="lg"
            onClick={handleCTAClick}
            className="w-full bg-[var(--accent-teal)] text-white shadow-lg shadow-[var(--accent-teal)]/20 hover:bg-[var(--accent-teal-hover)] hover:shadow-xl hover:shadow-[var(--accent-teal)]/30 sm:w-auto"
          >
            Get Started
          </Button>
        </motion.div>
      </div>
    </section>
  )
}
```

**Verification:** Hero should feel more spacious with soft atmospheric glows and smooth entrance animations.

---

## Task B5: Stone-Inspired Section Styling

**Files:**
- Create: `app/src/components/landing/home/zen-section.tsx`
- Modify: `app/src/components/landing/home/features-section.tsx`
- Modify: `app/src/components/landing/home/value-props-section.tsx`

**Create wrapper component with organic edges:**

```tsx
'use client'

import { ReactNode } from 'react'

interface ZenSectionProps {
  children: ReactNode
  className?: string
}

export function ZenSection({ children, className = '' }: ZenSectionProps) {
  return (
    <section className={`relative ${className}`}>
      {/* Organic top edge */}
      <div className="absolute -top-8 left-0 right-0 h-16 overflow-hidden" aria-hidden="true">
        <svg viewBox="0 0 1440 64" preserveAspectRatio="none" className="h-full w-full">
          <path
            d="M0 64V32C180 16 360 48 540 40C720 32 900 8 1080 16C1260 24 1350 48 1440 32V64H0Z"
            className="fill-[var(--background)]"
          />
        </svg>
      </div>

      {children}

      {/* Organic bottom edge */}
      <div className="absolute -bottom-8 left-0 right-0 h-16 rotate-180 overflow-hidden" aria-hidden="true">
        <svg viewBox="0 0 1440 64" preserveAspectRatio="none" className="h-full w-full">
          <path
            d="M0 64V32C180 16 360 48 540 40C720 32 900 8 1080 16C1260 24 1350 48 1440 32V64H0Z"
            className="fill-[var(--background)]"
          />
        </svg>
      </div>
    </section>
  )
}
```

**Verification:** Sections should have subtle organic wave transitions instead of hard edges.

---

## Task B6: Auto-Ripple on Scroll

**Files:**
- Create: `app/src/components/landing/home/scroll-ripple-trigger.tsx`
- Modify: `app/src/app/(marketing)/page.tsx`

**Create component that triggers ripples as sections enter viewport:**

```tsx
'use client'

import { useEffect, useRef } from 'react'
import { useWaterWebGLOptional } from '@/components/water-webgl/WaterWebGLContext'

interface ScrollRippleTriggerProps {
  className?: string
}

export function ScrollRippleTrigger({ className }: ScrollRippleTriggerProps) {
  const ref = useRef<HTMLDivElement>(null)
  const water = useWaterWebGLOptional()
  const hasTriggered = useRef(false)

  useEffect(() => {
    if (!ref.current || !water) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasTriggered.current) {
          hasTriggered.current = true

          // Get element center position
          const rect = entry.boundingClientRect
          const centerX = rect.left + rect.width / 2
          const centerY = rect.top + rect.height / 2

          // Trigger a gentle ripple
          water.triggerRipple(centerX, centerY, 0.8)
        }
      },
      { threshold: 0.5 }
    )

    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [water])

  return <div ref={ref} className={className} aria-hidden="true" />
}
```

**Add to page between sections:**

```tsx
<ScrollRippleTrigger className="h-1" />
```

**Verification:** Subtle ripples should trigger as you scroll to each section.

---

# Verification (Both Plans)

1. **Visual check:** Open `http://localhost:3000` in light mode
2. **Caustics:** Water caustic patterns should be clearly visible
3. **Ripples:** Click anywhere — ripples should be prominent
4. **Atmosphere:** Page should feel warm, misty, serene
5. **Performance:** No jank during scroll or interactions
6. **Dark mode:** Ensure dark mode still works (shouldn't be affected)

---

# Recommended Order

**To try Plan A first:** Implement Tasks A1 → A2 → A3 → A4 → A5

**To try Plan B first:** Implement Tasks B1 → B2 → B3 → B4 → B5 → B6

Both plans share B1/A1 (palette), so that should be done first regardless.
