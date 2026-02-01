'use client'

import { motion } from 'motion/react'
import { Quote } from 'lucide-react'

interface QuoteItem {
  id: string
  text: string
  author: string
  role: string
}

// Support-focused quotes: Knowledge/Efficiency pain points
const SUPPORT_QUOTES: QuoteItem[] = [
  {
    id: 'sup1',
    text: "I answer the same 10 questions every single day. Our docs exist, customers just don't read them.",
    author: 'Support Lead',
    role: 'B2B SaaS',
  },
  {
    id: 'sup2',
    text: "New support hires take 3 months to learn the product well enough to help customers.",
    author: 'Head of Support',
    role: 'Enterprise Software',
  },
  {
    id: 'sup3',
    text: "Our best support rep quit. She took half our product knowledge with her.",
    author: 'Customer Success Manager',
    role: 'Startup',
  },
  {
    id: 'sup4',
    text: "Customers wait 4 hours for answers that are already in our help center.",
    author: 'Support Engineer',
    role: 'Dev Tools',
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

export function SupportQuotesSection() {
  // Duplicate quotes for seamless infinite scroll
  const duplicatedQuotes = [...SUPPORT_QUOTES, ...SUPPORT_QUOTES]

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
            Support teams struggle with the same knowledge gap
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
