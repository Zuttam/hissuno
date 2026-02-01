'use client'

import { motion } from 'motion/react'
import { Quote } from 'lucide-react'

interface QuoteItem {
  id: string
  text: string
  author: string
  role: string
}

// FDE-focused quotes: Engineering/Speed pain points
const FDE_QUOTES: QuoteItem[] = [
  {
    id: 'fde1',
    text: "Customer reported a bug Monday. PR merged Friday. By then, three more users churned.",
    author: 'Engineering Lead',
    role: 'Series B Startup',
  },
  {
    id: 'fde2',
    text: "Our backlog has 200 items. Half are duplicates. Nobody has time to clean it up.",
    author: 'Senior Engineer',
    role: 'SaaS Platform',
  },
  {
    id: 'fde3',
    text: "We spend more time in triage meetings than actually building features.",
    author: 'Tech Lead',
    role: 'Dev Tools Company',
  },
  {
    id: 'fde4',
    text: "Every feature request goes through 5 people before an engineer sees it. By then the context is gone.",
    author: 'CTO',
    role: 'Early-Stage Startup',
  },
]

function QuoteCard({ quote }: { quote: QuoteItem }) {
  return (
    <div className="group relative mx-4 w-[320px] flex-shrink-0 rounded-xl border border-[var(--border-subtle)]/50 bg-[var(--surface)]/60 p-6 backdrop-blur-sm transition-all duration-300 hover:border-[var(--accent-teal)]/30 hover:bg-[var(--surface)]/80">
      {/* Quote icon */}
      <div
        className="mb-4 flex h-8 w-8 items-center justify-center rounded-lg"
        style={{ backgroundColor: 'color-mix(in srgb, var(--accent-teal) 15%, transparent)' }}
      >
        <Quote className="h-4 w-4 text-[var(--accent-teal)]" />
      </div>

      <blockquote>
        <p className="text-sm leading-relaxed text-[var(--foreground)]">
          &ldquo;{quote.text}&rdquo;
        </p>
      </blockquote>

      <div className="mt-4 border-t border-[var(--border-subtle)]/30 pt-4">
        <p className="font-mono text-xs font-medium text-[var(--foreground)]">
          {quote.author}
        </p>
        <p className="text-xs text-[var(--text-tertiary)]">
          {quote.role}
        </p>
      </div>
    </div>
  )
}

export function FDEQuotesSection() {
  // Duplicate quotes for seamless infinite scroll
  const duplicatedQuotes = [...FDE_QUOTES, ...FDE_QUOTES]

  return (
    <section className="overflow-hidden py-24">
      <div className="mx-auto max-w-6xl px-6 md:px-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center"
        >
          <h2 className="font-mono text-3xl font-bold text-[var(--foreground)]">
            Sound Familiar?
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-[var(--text-secondary)]">
            Engineering teams are drowning in customer feedback
          </p>
        </motion.div>
      </div>

      {/* Infinite scrolling carousel - single row */}
      <div className="relative mt-12">
        {/* Gradient fade on edges */}
        <div className="pointer-events-none absolute left-0 top-0 z-10 h-full w-24 bg-gradient-to-r from-[var(--background)] to-transparent" />
        <div className="pointer-events-none absolute right-0 top-0 z-10 h-full w-24 bg-gradient-to-l from-[var(--background)] to-transparent" />

        {/* Single row - scrolls left */}
        <div className="flex animate-scroll-left-slow">
          {duplicatedQuotes.map((quote, index) => (
            <QuoteCard key={`row1-${quote.id}-${index}`} quote={quote} />
          ))}
        </div>
      </div>

      <style jsx global>{`
        @keyframes scroll-left-slow {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }

        .animate-scroll-left-slow {
          animation: scroll-left-slow 40s linear infinite;
        }

        .animate-scroll-left-slow:hover {
          animation-play-state: paused;
        }
      `}</style>
    </section>
  )
}
