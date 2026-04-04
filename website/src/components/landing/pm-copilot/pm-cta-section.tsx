'use client'

import { Button } from '@/components/ui'
import { useWaterWebGLOptional } from '@/components/water-webgl/WaterWebGLContext'
import { WaterReveal } from '@/components/landing/water-reveal'
import { InstallCommand } from '@/components/landing/install-command'

export function PMCTASection() {
  const water = useWaterWebGLOptional()

  const handleButtonClick = (e: React.MouseEvent) => {
    water?.triggerRipple(e.clientX, e.clientY, 1.5)
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
            Build the Roadmap That Drives Revenue
          </h2>
        </WaterReveal>

        <WaterReveal preset="text" delay={0.15}>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-[var(--text-secondary)]">
            Let your AI Product Intelligence Agent connect every customer signal to business impact.
          </p>
        </WaterReveal>

        <WaterReveal preset="card" delay={0.25}>
          <div className="mt-8 flex flex-col items-center gap-4" onClick={handleButtonClick}>
            <InstallCommand />
            <a
              href="https://github.com/zuttam/hissuno"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button
                size="lg"
                variant="secondary"
              >
                View on GitHub
              </Button>
            </a>
          </div>
        </WaterReveal>
      </div>
    </section>
  )
}
