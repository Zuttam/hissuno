// Utilities
export { UTMCapture } from './utm-capture'

// Waitlist
export { WaitlistProvider, useWaitlist } from './waitlist-context'
export { WaitlistDialog } from './waitlist-dialog'
export { MarketingNav } from './marketing-nav'
export { MarketingLayoutClient } from './marketing-layout-client'

// Home page sections
export { HeroSection, FeaturesSection, ValuePropsSection, CommunitySection, CTASection } from './home'

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
