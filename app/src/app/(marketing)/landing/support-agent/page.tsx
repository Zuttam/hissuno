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
  title: 'Hissuno - AI Support Agent That Drives Retention',
  description:
    'AI support grounded in your codebase that cuts resolution time, reduces support costs, and turns every interaction into a retention opportunity.',
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
