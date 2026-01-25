export interface UTMParams {
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  utm_term?: string
  utm_content?: string
}

export interface SignupEventData {
  method: 'email' | 'google'
  utm?: UTMParams
}

export interface OnboardingCompletedEventData {
  selectedUseCases: string[]
  utm?: UTMParams
}

export interface CTAEventData {
  source:
    | 'nav'
    | 'hero'
    | 'cta_section'
    | 'roadmap'
    | 'login'
    | 'support_hero'
    | 'support_cta_section'
    | 'pm_hero'
    | 'pm_cta_section'
    | 'fde_hero'
    | 'fde_cta_section'
  option?: 'book_call' | 'join_waitlist'
  utm?: UTMParams
}

export interface CallBookingEventData {
  eventUri?: string
  inviteeUri?: string
  utm?: UTMParams
}
