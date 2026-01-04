'use client'

import Link from 'next/link'
import { motion } from 'motion/react'
import { Button } from '@/components/ui'
import { useWaterWebGLOptional } from '@/components/water-webgl/WaterWebGLContext'

export function CTASection() {
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
          Start your free trial today. No credit card required.
        </motion.p>
        <motion.div
          className="mt-8"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <Link href="/sign-up" onClick={handleButtonClick}>
            <Button
              size="lg"
              className="bg-[var(--accent-teal)] hover:bg-[var(--accent-teal-hover)]"
            >
              Get Started Free
            </Button>
          </Link>
        </motion.div>
      </div>
    </section>
  )
}
