import type { Metadata } from 'next'
import {
  SupportHeroSection,
  SupportFeaturesSection,
  SupportHowItWorksSection,
  SupportKnowledgeSection,
  SupportQuotesSection,
  SupportCTASection,
} from '@/components/landing/support-agent'
import { UTMCapture, MistOverlay } from '@/components/landing'

export const metadata: Metadata = {
  title: 'Hissuno - AI Support Agent for Your Product',
  description:
    'AI support that reduces noise, gives instant answers, and works across every channel. Answers backed by your codebase — no hallucinations.',
}

interface SupportAgentPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export default async function SupportAgentPage({ searchParams }: SupportAgentPageProps) {
  const resolvedParams = await (searchParams ?? Promise.resolve({}))

  return (
    <>
      {/* Client component to capture UTM params */}
      <UTMCapture searchParams={resolvedParams} />

      {/* Atmospheric mist overlay for light mode */}
      <MistOverlay />

      <SupportHeroSection />
      <SupportFeaturesSection />
      <SupportHowItWorksSection />
      <SupportKnowledgeSection />
      <SupportQuotesSection />
      <SupportCTASection />
    </>
  )
}
