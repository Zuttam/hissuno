'use client'

import { motion } from 'motion/react'
import { Quote } from 'lucide-react'

interface QuoteItem {
  id: string
  text: string
  author: string
  role: string
}

const QUOTES: QuoteItem[] = [
  {
    id: 'q1',
    text: "We lost a $200k deal because we shipped the wrong features. The signals were there — we just couldn't see them.",
    author: 'VP of Product',
    role: 'Series B Startup',
  },
  {
    id: 'q2',
    text: "Three enterprise customers churned in Q3. Every single pain point was buried in support tickets we never read.",
    author: 'Head of Customer Success',
    role: 'SaaS Company',
  },
  {
    id: 'q3',
    text: "We spent 6 months building a feature our competitor launched in 2 weeks. Our customers had been asking for it the whole time.",
    author: 'Engineering Lead',
    role: 'B2B Platform',
  },
  {
    id: 'q4',
    text: "Our sales team promised features to close deals. Product never saw those commitments until the customer threatened to cancel.",
    author: 'Founder',
    role: 'Early-stage Startup',
  },
  {
    id: 'q5',
    text: "We hired 3 support reps to handle volume. Turns out 60% of tickets were about the same 5 issues nobody fixed.",
    author: 'Director of Support',
    role: 'Enterprise Software',
  },
  {
    id: 'q6',
    text: "Our biggest customer told us exactly what they needed in a Gong call. That feedback sat in a spreadsheet for 8 months.",
    author: 'Account Executive',
    role: 'Growth Company',
  },
  {
    id: 'q7',
    text: "We built our roadmap from gut feel. 40% of what we shipped got zero adoption.",
    author: 'Product Manager',
    role: 'Dev Tools Company',
  },
  {
    id: 'q8',
    text: "Our NPS dropped 15 points before we realized there was a pattern in the complaints. By then, the damage was done.",
    author: 'CTO',
    role: 'Fintech Startup',
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

export function QuotesSection() {
  // Duplicate quotes for seamless infinite scroll
  const duplicatedQuotes = [...QUOTES, ...QUOTES]

  return (
    <section className="py-24 overflow-hidden">
      <div className="mx-auto max-w-6xl px-6 md:px-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center"
        >
          <h2 className="font-mono text-3xl font-bold text-[var(--foreground)]">
            The Cost of Flying Blind
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-[var(--text-secondary)]">
            When customer intelligence is broken, revenue pays the price
          </p>
        </motion.div>
      </div>

      {/* Infinite scrolling carousel */}
      <div className="relative mt-12">
        {/* Gradient fade on edges */}
        <div className="pointer-events-none absolute left-0 top-0 z-10 h-full w-24 bg-gradient-to-r from-[var(--background)] to-transparent" />
        <div className="pointer-events-none absolute right-0 top-0 z-10 h-full w-24 bg-gradient-to-l from-[var(--background)] to-transparent" />

        {/* First row - scrolls left */}
        <div className="flex animate-scroll-left">
          {duplicatedQuotes.map((quote, index) => (
            <QuoteCard key={`row1-${quote.id}-${index}`} quote={quote} />
          ))}
        </div>

        {/* Second row - scrolls right (reversed order) */}
        <div className="mt-6 flex animate-scroll-right">
          {[...duplicatedQuotes].reverse().map((quote, index) => (
            <QuoteCard key={`row2-${quote.id}-${index}`} quote={quote} />
          ))}
        </div>
      </div>

      <style jsx global>{`
        @keyframes scroll-left {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }

        @keyframes scroll-right {
          0% {
            transform: translateX(-50%);
          }
          100% {
            transform: translateX(0);
          }
        }

        .animate-scroll-left {
          animation: scroll-left 60s linear infinite;
        }

        .animate-scroll-right {
          animation: scroll-right 60s linear infinite;
        }

        .animate-scroll-left:hover,
        .animate-scroll-right:hover {
          animation-play-state: paused;
        }
      `}</style>
    </section>
  )
}
