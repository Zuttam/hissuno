'use client'

import { Button } from '@/components/ui'
import { useWaterWebGLOptional } from '@/components/water-webgl/WaterWebGLContext'
import { useCTA } from '@/components/landing/cta-context'
import { WaterReveal } from '@/components/landing/water-reveal'

export function SupportCTASection() {
  const water = useWaterWebGLOptional()
  const { openWaitlist } = useCTA()

  const handleButtonClick = (e: React.MouseEvent) => {
    water?.triggerRipple(e.clientX, e.clientY, 1.5)
    openWaitlist('support_cta_section')
  }

  return (
    <section className="relative px-6 py-24 md:px-12">
      {/* Gradient overlay for visual interest */}
      <div
        className="pointer-events-none absolute inset-0 opacity-20"
        style={{
          background:
            'radial-gradient(ellipse at center, var(--accent-teal) 0%, transparent 70%)',
        }}
      />

      <div className="relative z-10 mx-auto max-w-4xl text-center">
        <WaterReveal preset="text" parallax parallaxDepth={0.1}>
          <h2 className="font-mono text-3xl font-bold text-[var(--foreground)] md:text-4xl">
            Turn Support into a Retention Engine
          </h2>
        </WaterReveal>

        <WaterReveal preset="text" delay={0.15}>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-[var(--text-secondary)]">
            Instant, accurate answers that keep customers happy and reduce your support burden.
          </p>
        </WaterReveal>

        <WaterReveal preset="card" delay={0.25}>
          <div className="mt-8 flex flex-col items-center">
            <Button
              size="lg"
              onClick={handleButtonClick}
              className="bg-[var(--accent-selected)] hover:opacity-90"
            >
              Join the Beta
            </Button>
            <p className="mt-2 text-sm text-[var(--text-tertiary)]">
              Get early access
            </p>
          </div>
        </WaterReveal>
      </div>
    </section>
  )
}
