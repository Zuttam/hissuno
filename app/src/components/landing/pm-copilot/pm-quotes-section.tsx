'use client'

import { motion } from 'motion/react'
import { Quote } from 'lucide-react'

interface QuoteItem {
  id: string
  text: string
  author: string
  role: string
}

// PM-focused quotes emphasizing business impact of bad prioritization
const PM_QUOTES: QuoteItem[] = [
  {
    id: 'q1',
    text: "We prioritized by gut feel for two quarters. 40% of what we shipped had zero adoption. That's months of engineering time wasted.",
    author: 'VP of Product',
    role: 'Series B Startup',
  },
  {
    id: 'q2',
    text: "Our biggest customer told us what they needed in 3 separate Gong calls. We built something else. They churned.",
    author: 'Head of Product',
    role: 'SaaS Company',
  },
  {
    id: 'q3',
    text: "Sales promised features to close deals. Product never saw those commitments until customers threatened to cancel.",
    author: 'Product Manager',
    role: 'B2B Platform',
  },
  {
    id: 'q4',
    text: "We built our roadmap from anecdotes, not evidence. Lost three enterprise deals because we missed what they actually needed.",
    author: 'Senior PM',
    role: 'Enterprise Software',
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

export function PMQuotesSection() {
  // Duplicate quotes for seamless infinite scroll
  const duplicatedQuotes = [...PM_QUOTES, ...PM_QUOTES]

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
            The Hidden Cost of Bad Prioritization
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-[var(--text-secondary)]">
            Wrong priorities compound into lost revenue and churned customers
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
