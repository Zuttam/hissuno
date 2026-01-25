import type { Metadata } from 'next'
import {
  FDEHeroSection,
  FDEFeaturesSection,
  FDEValuePropsSection,
  FDEQuotesSection,
  FDECTASection,
} from '@/components/landing/fde'
import { UTMCapture, MistOverlay } from '@/components/landing'

export const metadata: Metadata = {
  title: 'Hissuno - AI FDE (Forward Development Engineer)',
  description:
    'An AI engineer that listens to customers, opens tickets, and ships code changes — from customer request to pull request in record time.',
}

interface FDEPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export default async function FDEPage({ searchParams }: FDEPageProps) {
  const resolvedParams = await (searchParams ?? Promise.resolve({}))

  return (
    <>
      {/* Client component to capture UTM params */}
      <UTMCapture searchParams={resolvedParams} />

      {/* Atmospheric mist overlay for light mode */}
      <MistOverlay />

      <FDEHeroSection />
      <FDEFeaturesSection />
      <FDEValuePropsSection />
      <FDEQuotesSection />
      <FDECTASection />
    </>
  )
}
