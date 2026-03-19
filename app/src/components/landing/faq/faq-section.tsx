'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { WaterReveal } from '@/components/landing/water-reveal'

interface FAQItem {
  question: string
  answer: string
}

interface FAQCategory {
  title: string
  items: FAQItem[]
}

const FAQ_DATA: FAQCategory[] = [
  {
    title: 'Why Hissuno?',
    items: [
      {
        question: 'What is Hissuno?',
        answer:
          'Hissuno is an open-source unified context layer that turns all your product-related data into an agent-ready knowledge graph. For example, your codebase, docs, customer conversations, support tickets, issues, and usage signals all get ingested, connected, and exposed via MCP, CLI, and API - so any AI agent can query your product intelligence natively.',
      },
      {
        question: 'Why not just connect AI agents to my tools directly?',
        answer:
          'Direct integrations give agents access to data silos. Hissuno gives them a connected, enriched, product-aware intelligence layer. The difference: "I can read your Intercom tickets" vs "I understand your product, your customers, and how they connect."',
      },
      {
        question: 'What is the knowledge graph?',
        answer:
          'A universal relationship layer connecting every entity - contacts, companies, conversations, issues, product areas, code. One query can traverse from a customer to their conversations to related issues to affected product areas to the relevant codebase.',
      },
      {
        question: 'How is this different from raw API data?',
        answer:
          'Hissuno runs multi-step AI workflows on ingest: feedback gets classified, summarized, deduplicated, and auto-triaged. Issues get RICE-scored. Contacts are auto-resolved and linked. Agents get processed intelligence, not raw tickets to parse.',
      },
    ],
  },
  {
    title: 'For AI Agents',
    items: [
      {
        question: 'How do agents connect to Hissuno?',
        answer:
          'Via MCP (Model Context Protocol), REST API, or CLI. Any agent - support bot, coding assistant, PM copilot - connects once and gets the full picture.',
      },
      {
        question: 'How does Hissuno save tokens and context window?',
        answer:
          'Instead of pulling raw data from 10+ sources every query, agents query pre-processed, deduplicated, structured intelligence. One compact response vs. thousands of raw API records.',
      },
      {
        question: 'What about multi-agent consistency?',
        answer:
          'Without Hissuno, different agents might classify the same conversation differently. Hissuno classifies once, links once, scores once. Every agent reads from the same resolved graph.',
      },
      {
        question: 'How does deduplication work?',
        answer:
          'Every session, issue, and contact is embedded into a shared vector space on ingest. New items are automatically compared against the full index to find duplicates - O(1) per new item, not O(n) per query.',
      },
    ],
  },
  {
    title: 'Integrations & Setup',
    items: [
      {
        question: 'What integrations does Hissuno support?',
        answer:
          '12+ integrations: Intercom, Zendesk, Slack, Gong, GitHub, Notion, HubSpot, Linear, Jira, PostHog, Fathom, and more. Add one integration and every agent benefits instantly.',
      },
      {
        question: 'How do I get started?',
        answer:
          'Run npm i -g hissuno && hissuno setup - it walks you through infrastructure setup (database, AI provider). Then connect your sources and start querying.',
      },
      {
        question: 'Is Hissuno open source?',
        answer:
          'Yes, fully open source and self-hostable. Deploy on your own infrastructure with full control over your data.',
      },
      {
        question: 'Can I use Hissuno with Claude Desktop / Cursor / other AI tools?',
        answer:
          'Yes. The Hissuno CLI ships with dedicated skills for Claude Code, Cursor, and other AI coding tools - giving agents deep product intelligence right in their workflow. Hissuno also exposes an MCP server that any MCP-compatible tool (Claude Desktop, Windsurf, etc.) can connect to natively.',
      },
    ],
  },
  {
    title: 'Product Features',
    items: [
      {
        question: "What's the difference between the Support Agent and PM Co-Pilot?",
        answer:
          'The Support Agent is customer-facing: answers questions grounded in your codebase and docs. The PM Co-Pilot is team-facing: queries issues, feedback, contacts, and surfaces product intelligence for decision-making.',
      },
      {
        question: 'How does the feedback loop work?',
        answer:
          'Every customer interaction enriches the graph automatically. Conversations get classified, linked to customers, deduplicated against existing issues, and connected to product areas. The graph gets denser and more useful over time.',
      },
      {
        question: 'Does Hissuno handle access control?',
        answer:
          'Yes. Two auth modes: user (full project access for internal agents) and contact (scoped to that contact\'s data for customer-facing bots). Same graph, different visibility.',
      },
    ],
  },
]

function FAQAccordionItem({ item, index }: { item: FAQItem; index: number }) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <WaterReveal preset="text" staggerIndex={index} stagger="tight">
      <div className="border-b border-[var(--border)]/50">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex w-full items-center justify-between gap-4 py-5 text-left transition-colors hover:text-[var(--accent-teal)]"
        >
          <span className="font-mono text-sm font-medium text-[var(--foreground)]">
            {item.question}
          </span>
          <ChevronDown
            className={`h-4 w-4 flex-shrink-0 text-[var(--text-tertiary)] transition-transform duration-200 ${
              isOpen ? 'rotate-180' : ''
            }`}
          />
        </button>
        <div
          className={`grid transition-[grid-template-rows] duration-200 ease-out ${
            isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
          }`}
        >
          <div className="overflow-hidden">
            <p className="pb-5 text-sm leading-relaxed text-[var(--text-secondary)]">
              {item.answer}
            </p>
          </div>
        </div>
      </div>
    </WaterReveal>
  )
}

export function FAQSection() {
  let globalIndex = 0

  return (
    <section className="relative px-6 pb-24 md:px-12">
      <div className="mx-auto max-w-3xl">
        {FAQ_DATA.map((category) => (
          <div key={category.title} className="mb-12 last:mb-0">
            <WaterReveal preset="text">
              <h2 className="mb-6 font-mono text-xs font-semibold uppercase tracking-widest text-[var(--accent-teal)]">
                {category.title}
              </h2>
            </WaterReveal>
            <div>
              {category.items.map((item) => {
                const idx = globalIndex++
                return <FAQAccordionItem key={item.question} item={item} index={idx} />
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
