export type { UTMParams, InstallCommandCopiedEventData, GitHubRepoClickedEventData } from './types'

export {
  parseUTMFromURL,
  parseUTMFromObject,
  storeUTM,
  getStoredUTM,
  clearStoredUTM,
  buildUTMQueryString,
} from './utm'

export {
  trackInstallCommandCopied,
  trackGitHubRepoClicked,
  trackPageView,
} from './events'
