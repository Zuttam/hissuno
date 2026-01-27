import type { Metadata } from 'next'
import {
  RoadmapHeroSection,
  RoadmapTimeline,
  RoadmapCTASection,
} from '@/components/landing/roadmap'
import { MistOverlay } from '@/components/landing'

export const metadata: Metadata = {
  title: 'Roadmap - Hissuno',
  description:
    'See what we\'ve built, what we\'re building now, and where Hissuno is heading next. Transparency in product development.',
}

export default function RoadmapPage() {
  return (
    <>
      {/* Atmospheric mist overlay for light mode */}
      <MistOverlay />

      <RoadmapHeroSection />
      <RoadmapTimeline />
      <RoadmapCTASection />
    </>
  )
}
