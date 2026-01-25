import type { Metadata } from 'next'
import {
  PMHeroSection,
  PMFeaturesSection,
  PMValuePropsSection,
  PMQuotesSection,
  PMCTASection,
} from '@/components/landing/pm-copilot'
import { UTMCapture, MistOverlay } from '@/components/landing'

export const metadata: Metadata = {
  title: 'Hissuno - AI PM Co-Pilot',
  description:
    'An AI agent that watches customer conversations, triages feedback, and writes specs — so you can focus on what to build next.',
}

interface PMCopilotPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export default async function PMCopilotPage({ searchParams }: PMCopilotPageProps) {
  const resolvedParams = await (searchParams ?? Promise.resolve({}))

  return (
    <>
      {/* Client component to capture UTM params */}
      <UTMCapture searchParams={resolvedParams} />

      {/* Atmospheric mist overlay for light mode */}
      <MistOverlay />

      <PMHeroSection />
      <PMFeaturesSection />
      <PMValuePropsSection />
      <PMQuotesSection />
      <PMCTASection />
    </>
  )
}
