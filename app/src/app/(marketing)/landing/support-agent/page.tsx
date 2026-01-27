import type { Metadata } from 'next'
import {
  SupportHeroSection,
  SupportFeaturesSection,
  SupportHowItWorksSection,
  SupportCTASection,
} from '@/components/landing/support-agent'
import { UTMCapture, MistOverlay } from '@/components/landing'

export const metadata: Metadata = {
  title: 'Hissuno - AI Support Agent for Your Product',
  description:
    'AI support that answers customer questions using your codebase. Embed in your website or Slack. No training required.',
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
      <SupportCTASection />
    </>
  )
}
