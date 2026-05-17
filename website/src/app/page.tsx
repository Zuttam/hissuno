import {
  HeroSection,
  ProblemSection,
  FeaturesSection,
  InterfacesSection,
  AgentsShowcaseSection,
  AutomationsSection,
  QuotesSection,
  CTASection,
  UTMCapture,
  MistOverlay,
} from '@/components/landing'

interface MarketingPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export default async function MarketingPage({ searchParams }: MarketingPageProps) {
  const resolvedParams = await (searchParams ?? Promise.resolve({}))

  return (
    <>
      {/* Client component to capture UTM params */}
      <UTMCapture searchParams={resolvedParams} />

      {/* Atmospheric mist overlay for light mode */}
      <MistOverlay />

      <HeroSection />
      <ProblemSection />
      <FeaturesSection />
      <AutomationsSection />
      <AgentsShowcaseSection />
      <InterfacesSection />
      <QuotesSection />
      <CTASection />
    </>
  )
}
