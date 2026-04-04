export interface UTMParams {
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  utm_term?: string
  utm_content?: string
}

export interface InstallCommandCopiedEventData {
  command_type: 'setup' | 'config' | 'cli' | 'git_clone'
  source: 'hero' | 'nav' | 'docs'
  utm?: UTMParams
}

export interface GitHubRepoClickedEventData {
  source: 'nav' | 'hero' | 'docs'
  utm?: UTMParams
}

export interface CallBookingEventData {
  eventUri?: string
  inviteeUri?: string
  utm?: UTMParams
}
