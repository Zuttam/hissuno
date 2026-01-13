'use client'

import { motion } from 'motion/react'

export function QuoteSection() {
  return (
    <section className="px-6 py-16 md:px-12">
      <div className="mx-auto max-w-3xl">
        <motion.blockquote
          className="relative text-center"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          {/* Decorative quote marks */}
          <span
            className="absolute -left-4 -top-4 font-serif text-6xl text-[var(--accent-teal)] opacity-20 md:-left-8 md:-top-6 md:text-8xl"
            aria-hidden
          >
            &ldquo;
          </span>

          <p className="relative font-mono text-xl leading-relaxed text-[var(--foreground)] md:text-2xl">
            Users love a site that&apos;s constantly improving. They&apos;ll like you even better
            when you improve in response to their comments, because customers are used to companies
            ignoring them.
          </p>

          <footer className="mt-6">
            <cite className="not-italic text-[var(--text-secondary)]">
              — <span className="font-semibold text-[var(--foreground)]">Paul Graham</span>
            </cite>
          </footer>
        </motion.blockquote>
      </div>
    </section>
  )
}
