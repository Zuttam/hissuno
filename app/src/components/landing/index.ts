// Utilities
export { UTMCapture } from './utm-capture'

// CTA (unified context for all CTA flows)
export { CTAProvider, useCTA } from './cta-context'
export { CTAOptionsDialog } from './cta-options-dialog'
export { WaitlistDialog } from './waitlist-dialog'
export { ThankYouModal } from './thank-you-modal'

// Navigation
export { MarketingNav } from './marketing-nav'

// Home page sections
export { HeroSection, FeaturesSection, ValuePropsSection, CommunitySection, CTASection, MistOverlay } from './home'

// Tool-specific landing pages
export {
  ToolHeroSection,
  ProblemSection,
  SolutionSection,
  BenefitsSection,
  QuoteSection,
  EarlyAccessCTASection,
  getToolConfig,
  getSupportedToolSlugs,
  SUPPORTED_TOOLS,
} from './tool-landing'
export type { ToolConfig } from './tool-landing'

// Roadmap page
export {
  RoadmapHeroSection,
  RoadmapTimeline,
  RoadmapPhaseCard,
  RoadmapItem,
  RoadmapCTASection,
} from './roadmap'
