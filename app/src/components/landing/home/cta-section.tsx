'use client'

import { motion } from 'motion/react'
import { Button } from '@/components/ui'
import { useWaterWebGLOptional } from '@/components/water-webgl/WaterWebGLContext'
import { useCTA } from '@/components/landing/cta-context'

export function CTASection() {
  const water = useWaterWebGLOptional()
  const { openCTAOptions } = useCTA()

  const handleButtonClick = (e: React.MouseEvent) => {
    water?.triggerRipple(e.clientX, e.clientY, 1.5)
    openCTAOptions('cta_section')
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
        <motion.h2
          className="font-mono text-3xl font-bold text-[var(--foreground)] md:text-4xl"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          Ready to transform customer feedback into action?
        </motion.h2>
        <motion.p
          className="mx-auto mt-4 max-w-2xl text-lg text-[var(--text-secondary)]"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          Book a call to see Hissuno in action, or join the waitlist.
        </motion.p>
        <motion.div
          className="mt-8"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <Button
            size="lg"
            onClick={handleButtonClick}
            className="bg-[var(--accent-selected)] hover:opacity-90"
          >
            Get Started
          </Button>
        </motion.div>
      </div>
    </section>
  )
}
