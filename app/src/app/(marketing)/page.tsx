import {
  HeroSection,
  FeaturesSection,
  ValuePropsSection,
  CommunitySection,
  CTASection,
  UTMCapture,
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

      <HeroSection />
      <FeaturesSection />
      <ValuePropsSection />
      {/* <CommunitySection /> */}
      <CTASection />
    </>
  )
}
