'use client'

import { motion } from 'motion/react'

export function FAQHeroSection() {
  return (
    <section className="relative px-6 pb-12 pt-20 md:px-12 md:pt-28">
      <div className="mx-auto max-w-3xl text-center">
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="font-mono text-4xl font-bold text-[var(--foreground)] md:text-5xl"
        >
          Frequently Asked Questions
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="mt-4 text-lg text-[var(--text-secondary)]"
        >
          Everything you need to know about Hissuno - the unified context layer for product agents.
        </motion.p>
      </div>
    </section>
  )
}
