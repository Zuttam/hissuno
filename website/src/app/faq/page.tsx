import type { Metadata } from 'next'
import { FAQHeroSection, FAQSection, FAQCTASection } from '@/components/landing/faq'
import { UTMCapture, MistOverlay } from '@/components/landing'

export const metadata: Metadata = {
  title: 'FAQ - Hissuno',
  description:
    'Frequently asked questions about Hissuno - the unified context layer that connects your codebase, docs, and customer signals for any AI agent.',
}

interface FAQPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export default async function FAQPage({ searchParams }: FAQPageProps) {
  const resolvedParams = await (searchParams ?? Promise.resolve({}))

  return (
    <>
      <UTMCapture searchParams={resolvedParams} />
      <MistOverlay />

      <FAQHeroSection />
      <FAQSection />
      <FAQCTASection />
    </>
  )
}
