'use client'

import { motion } from 'motion/react'

const STEPS = [
  {
    number: '1',
    title: 'Connect your channels',
    description: 'Drop in our widget or connect Slack. Takes 5 minutes.',
  },
  {
    number: '2',
    title: 'AI handles conversations',
    description:
      'Our support agent answers customers using your codebase and docs as knowledge. No training required.',
  },
  {
    number: '3',
    title: 'Issues write themselves',
    description:
      'Customer requests become triaged issues with product specs. Ready for your next build session.',
  },
]

export function SolutionSection() {
  return (
    <section className="px-6 py-24 md:px-12">
      <div className="mx-auto max-w-4xl">
        <motion.h2
          className="text-center font-mono text-3xl font-bold text-[var(--foreground)]"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          From conversation to code — automatically
        </motion.h2>

        <div className="mt-16">
          <div className="relative">
            {/* Connecting line */}
            <div className="absolute left-6 top-0 hidden h-full w-px bg-gradient-to-b from-[var(--accent-teal)] via-[var(--accent-selected)] to-[var(--accent-teal)] md:left-1/2 md:block md:-translate-x-1/2" />

            <div className="space-y-12 md:space-y-16">
              {STEPS.map((step, index) => (
                <motion.div
                  key={step.number}
                  className="relative flex items-start gap-6 md:gap-8"
                  initial={{ opacity: 0, x: index % 2 === 0 ? -20 : 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: index * 0.15 }}
                >
                  {/* Step number */}
                  <div className="relative z-10 flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-[var(--accent-teal)] font-mono text-lg font-bold text-white md:absolute md:left-1/2 md:-translate-x-1/2">
                    {step.number}
                  </div>

                  {/* Content */}
                  <div
                    className={`flex-1 md:w-[calc(50%-3rem)] ${
                      index % 2 === 0 ? 'md:pr-16 md:text-right' : 'md:ml-auto md:pl-16'
                    }`}
                  >
                    <h3 className="font-mono text-xl font-semibold text-[var(--foreground)]">
                      {step.title}
                    </h3>
                    <p className="mt-2 text-[var(--text-secondary)]">{step.description}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
