import type { Metadata } from 'next'
import { MarketingLayoutClient } from '@/components/landing/marketing-layout-client'

export const metadata: Metadata = {
  title: 'Hissuno - Turn Customer Conversations into Engineering Work',
  description:
    'AI-powered customer intelligence platform that converts conversations into actionable issues, product specs, and code changes.',
}

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return <MarketingLayoutClient>{children}</MarketingLayoutClient>
}
