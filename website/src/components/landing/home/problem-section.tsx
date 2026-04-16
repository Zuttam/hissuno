'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { motion, useInView } from 'motion/react'
import Image from 'next/image'
import { GripVertical, User } from 'lucide-react'
import { ThemeLogo } from '@/components/ui/theme-logo'

// --- Logo definitions ---

interface LogoDef {
  name: string
  src: string
  colored?: boolean // true = skip dark:invert
}

const CHAOS_LOGOS: (LogoDef & {
  x: number
  y: number
  rotation: number
  scale: number
  bobDuration: number
  bobAmplitude: number
  mobileHidden?: boolean
})[] = [
  { name: 'Slack', src: '/logos/slack.svg', colored: true, x: 8, y: 12, rotation: -15, scale: 1, bobDuration: 2.8, bobAmplitude: 6 },
  { name: 'Gong', src: '/logos/gong.svg', colored: true, x: 72, y: 8, rotation: 12, scale: 0.9, bobDuration: 3.2, bobAmplitude: 5 },
  { name: 'GitHub', src: '/logos/github.svg', x: 40, y: 5, rotation: -8, scale: 1.1, bobDuration: 2.5, bobAmplitude: 7 },
  { name: 'Intercom', src: '/logos/intercom.svg', colored: true, x: 20, y: 55, rotation: 10, scale: 0.85, bobDuration: 3.5, bobAmplitude: 4 },
  { name: 'Google Drive', src: '/logos/google-drive.svg', colored: true, x: 80, y: 50, rotation: -12, scale: 0.95, bobDuration: 2.6, bobAmplitude: 6, mobileHidden: true },
  { name: 'Notion', src: '/logos/notion.svg', x: 62, y: 65, rotation: 18, scale: 0.9, bobDuration: 3.0, bobAmplitude: 5 },
  { name: 'Linear', src: '/logos/linear.svg', colored: true, x: 5, y: 75, rotation: -5, scale: 1.05, bobDuration: 2.9, bobAmplitude: 7, mobileHidden: true },
  { name: 'Jira', src: '/logos/jira.svg', colored: true, x: 85, y: 30, rotation: 7, scale: 0.88, bobDuration: 3.3, bobAmplitude: 4 },
  { name: 'Gmail', src: '/logos/gmail.svg', colored: true, x: 30, y: 78, rotation: -14, scale: 0.92, bobDuration: 2.7, bobAmplitude: 6 },
  { name: 'Zendesk', src: '/logos/zendesk.svg', x: 55, y: 30, rotation: 9, scale: 0.87, bobDuration: 3.1, bobAmplitude: 5, mobileHidden: true },
  { name: 'HubSpot', src: '/logos/hubspot.svg', colored: true, x: 15, y: 35, rotation: -11, scale: 0.93, bobDuration: 2.4, bobAmplitude: 7, mobileHidden: true },
  { name: 'Amplitude', src: '/logos/amplitude.svg', colored: true, x: 75, y: 78, rotation: 6, scale: 0.86, bobDuration: 3.4, bobAmplitude: 4, mobileHidden: true },
  { name: 'PostHog', src: '/logos/posthog.svg', colored: true, x: 32, y: 40, rotation: -3, scale: 0.91, bobDuration: 2.3, bobAmplitude: 5, mobileHidden: true },
]

const SOURCE_LOGOS: LogoDef[] = [
  { name: 'Slack', src: '/logos/slack.svg', colored: true },
  { name: 'GitHub', src: '/logos/github.svg' },
  { name: 'Intercom', src: '/logos/intercom.svg', colored: true },
  { name: 'Gong', src: '/logos/gong.svg', colored: true },
  { name: 'Gmail', src: '/logos/gmail.svg', colored: true },
  { name: 'Linear', src: '/logos/linear.svg', colored: true },
]

interface AgentLogoDef {
  name: string
  src?: string
  colored?: boolean
  label: string
  isHissuno?: boolean
}

const AGENT_LOGOS: AgentLogoDef[] = [
  { name: 'Anthropic', src: '/logos/anthropic.svg', label: 'Claude Code' },
  { name: 'OpenAI', src: '/logos/openai.svg', label: 'Codex' },
  { name: 'Cursor', src: '/logos/cursor.svg', label: 'Cursor' },
  { name: 'Hissuno', label: 'Support Agent', isHissuno: true },
  { name: 'OpenClaw', src: '/logos/openclaw.svg', label: 'OpenClaw' },
]

// --- Chaos panel (Before) ---

function ChaosPanel() {
  return (
    <div className="relative flex h-full w-full items-center justify-center">
      {/* Warm overlay for "broken" atmosphere */}
      <div
        className="absolute inset-0 rounded-lg"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(255,180,100,0.06) 0%, transparent 70%)',
        }}
        aria-hidden="true"
      />

      {/* Central human silhouette */}
      <div className="relative z-10 flex h-14 w-14 items-center justify-center rounded-full border border-[var(--border)]/30 bg-[var(--surface)]/50 md:h-16 md:w-16">
        <User className="h-7 w-7 text-[var(--text-tertiary)] md:h-8 md:w-8" />
      </div>

      {/* Scattered logos */}
      {CHAOS_LOGOS.map((logo) => (
        <motion.div
          key={logo.name}
          animate={{ y: [0, -logo.bobAmplitude, 0] }}
          transition={{
            duration: logo.bobDuration,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className={`absolute opacity-70 ${logo.mobileHidden ? 'hidden md:flex' : 'flex'}`}
          style={{
            left: `${logo.x}%`,
            top: `${logo.y}%`,
            transform: `rotate(${logo.rotation}deg) scale(${logo.scale})`,
          }}
          title={logo.name}
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-md border border-[var(--border)]/20 bg-[var(--surface)]/60 shadow-sm backdrop-blur-sm md:h-9 md:w-9">
            <Image
              src={logo.src}
              alt={logo.name}
              width={18}
              height={18}
              className={logo.colored ? 'h-[18px] w-[18px]' : 'h-[18px] w-[18px] dark:invert'}
            />
          </div>
        </motion.div>
      ))}

      {/* Caption */}
      <p className="absolute bottom-3 left-0 right-0 text-center font-mono text-xs text-[var(--text-tertiary)] md:text-sm">
        10+ tools. No shared context.
      </p>
    </div>
  )
}

// --- Flow panel (After) ---

function FlowArrow() {
  return (
    <div className="flex shrink-0 items-center px-1 md:px-2">
      <svg width="40" height="20" viewBox="0 0 40 20" fill="none" className="hidden md:block">
        <motion.line
          x1="0"
          y1="10"
          x2="32"
          y2="10"
          stroke="var(--accent-teal)"
          strokeWidth="1.5"
          strokeDasharray="4 3"
          animate={{ strokeDashoffset: [0, -14] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
        />
        <motion.path
          d="M30 5 L37 10 L30 15"
          stroke="var(--accent-teal)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
      {/* Mobile: vertical arrow */}
      <svg width="20" height="24" viewBox="0 0 20 24" fill="none" className="block md:hidden">
        <motion.line
          x1="10"
          y1="0"
          x2="10"
          y2="18"
          stroke="var(--accent-teal)"
          strokeWidth="1.5"
          strokeDasharray="4 3"
          animate={{ strokeDashoffset: [0, -14] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
        />
        <path
          d="M5 16 L10 22 L15 16"
          stroke="var(--accent-teal)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
    </div>
  )
}

function FlowPanel() {
  return (
    <div className="relative flex h-full w-full items-center justify-center px-3 md:px-6">
      <div className="flex w-full max-w-md flex-col items-center gap-3 md:flex-row md:items-center md:justify-center md:gap-0">
        {/* Sources column */}
        <div className="flex shrink-0 flex-row flex-wrap items-center justify-center gap-2 md:flex-col md:gap-1.5">
          {SOURCE_LOGOS.map((logo, i) => (
            <motion.div
              key={logo.name}
              initial={{ opacity: 0, x: -10 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.05 }}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-[var(--border)]/30 bg-[var(--surface)]/60 md:h-8 md:w-8"
              title={logo.name}
            >
              <Image
                src={logo.src}
                alt={logo.name}
                width={16}
                height={16}
                className={logo.colored ? 'h-4 w-4' : 'h-4 w-4 dark:invert'}
              />
            </motion.div>
          ))}
        </div>

        <FlowArrow />

        {/* Hissuno center */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="flex shrink-0 flex-col items-center gap-1.5 rounded-lg border border-[var(--accent-teal)]/30 bg-[var(--surface)]/80 px-4 py-3 shadow-sm md:px-5 md:py-4"
        >
          <ThemeLogo width={64} height={22} className="h-[22px] w-auto" />
          <span className="font-mono text-[10px] text-[var(--accent-teal)] md:text-xs">Knowledge Graph</span>
        </motion.div>

        <FlowArrow />

        {/* Agents column */}
        <div className="flex shrink-0 flex-col items-start gap-1.5">
          {AGENT_LOGOS.map((logo, i) => (
            <motion.div
              key={logo.name}
              initial={{ opacity: 0, x: 10 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: 0.3 + i * 0.05 }}
              className="flex items-center gap-1.5"
              title={logo.label}
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-md border border-[var(--border)]/30 bg-[var(--surface)]/60 md:h-8 md:w-8">
                {logo.isHissuno ? (
                  <span className="font-mono text-xs font-bold text-[var(--accent-teal)]">H</span>
                ) : (
                  <Image
                    src={logo.src!}
                    alt={logo.name}
                    width={16}
                    height={16}
                    className={logo.colored ? 'h-4 w-4' : 'h-4 w-4 dark:invert'}
                  />
                )}
              </div>
              <span className="hidden text-[10px] text-[var(--text-secondary)] md:inline">{logo.label}</span>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Caption */}
      <p className="absolute bottom-3 left-0 right-0 text-center font-mono text-xs text-[var(--accent-teal)] md:text-sm">
        One graph. Every agent connected.
      </p>
    </div>
  )
}

// --- Comparison Slider ---

export function ProblemSection() {
  const [position, setPosition] = useState(50)
  const [isDragging, setIsDragging] = useState(false)
  const [hasHinted, setHasHinted] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const isInView = useInView(containerRef, { once: true, amount: 0.3 })

  // Auto-nudge hint on first viewport entry
  useEffect(() => {
    if (isInView && !hasHinted) {
      setHasHinted(true)
      const timeout = setTimeout(() => {
        setPosition(55)
        setTimeout(() => setPosition(50), 500)
      }, 800)
      return () => clearTimeout(timeout)
    }
  }, [isInView, hasHinted])

  const updatePosition = useCallback((clientX: number) => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const x = clientX - rect.left
    const pct = Math.max(5, Math.min(95, (x / rect.width) * 100))
    setPosition(pct)
  }, [])

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault()
      setIsDragging(true)
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
      updatePosition(e.clientX)
    },
    [updatePosition]
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging) return
      updatePosition(e.clientX)
    },
    [isDragging, updatePosition]
  )

  const handlePointerUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      setPosition((p) => Math.max(5, p - 5))
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      setPosition((p) => Math.min(95, p + 5))
    }
  }, [])

  return (
    <section className="px-6 py-12 md:px-12">
      <div className="mx-auto max-w-6xl">
        <h2 className="text-center font-mono text-3xl font-bold text-[var(--foreground)]">
          Your Product Data Is Fragmented
        </h2>

        <p className="mx-auto mt-4 max-w-2xl text-center text-[var(--text-secondary)]">
          Every product agent needs the same context - your codebase, docs, customer history, feedback. But each rebuilds its own fragmented view from 10+ scattered tools.
        </p>

        <div
          ref={containerRef}
          className="relative mx-auto mt-16 h-64 max-w-4xl cursor-ew-resize select-none overflow-hidden rounded-xl border border-[var(--border)] md:h-80"
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          {/* After panel (full width, behind) */}
          <div className="absolute inset-0 bg-[var(--background)]">
            <FlowPanel />
          </div>

          {/* Before panel (clipped to left side) */}
          <div
            className="absolute inset-0 bg-[var(--background)]"
            style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
          >
            <ChaosPanel />
          </div>

          {/* Divider handle */}
          <div
            className="absolute top-0 bottom-0 z-20"
            style={{ left: `${position}%`, transform: 'translateX(-50%)' }}
          >
            {/* Vertical line */}
            <div className="h-full w-px bg-[var(--accent-teal)]" />

            {/* Grip handle */}
            <div
              role="slider"
              tabIndex={0}
              aria-label="Comparison slider"
              aria-valuenow={Math.round(position)}
              aria-valuemin={5}
              aria-valuemax={95}
              onPointerDown={handlePointerDown}
              onKeyDown={handleKeyDown}
              className="absolute top-1/2 left-1/2 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize items-center justify-center rounded-full border border-[var(--accent-teal)] bg-[var(--background)] shadow-md transition-shadow hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-teal)]"
            >
              <GripVertical className="h-4 w-4 text-[var(--accent-teal)]" />
            </div>
          </div>

          {/* Before / After labels */}
          <div className="pointer-events-none absolute top-3 left-4 z-10 rounded-md bg-[var(--background)]/80 px-2 py-0.5 font-mono text-xs text-[var(--text-tertiary)] backdrop-blur-sm">
            Before
          </div>
          <div className="pointer-events-none absolute top-3 right-4 z-10 rounded-md bg-[var(--background)]/80 px-2 py-0.5 font-mono text-xs text-[var(--accent-teal)] backdrop-blur-sm">
            After
          </div>
        </div>
      </div>
    </section>
  )
}
