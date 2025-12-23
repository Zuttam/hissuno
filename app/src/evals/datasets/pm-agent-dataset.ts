/**
 * PM Agent Evaluation Dataset
 *
 * This dataset contains realistic support session conversations for evaluating
 * the Product Manager agent's classification and issue management capabilities.
 */

import type { PMEvalDataset, PMEvalTestCase, PMEvalSeedIssue } from './types'

/**
 * Seed issues for duplicate detection tests
 * These issues exist in the system before running tests
 */
const seedIssues: PMEvalSeedIssue[] = [
  {
    id: 'seed-bug-checkout',
    type: 'bug',
    title: 'Checkout button unresponsive on mobile Safari',
    description:
      'Users report that the checkout button does not respond to taps on mobile Safari. The button appears clickable but nothing happens when pressed. This affects iOS 16+ users.',
    priority: 'high',
    upvoteCount: 3,
  },
  {
    id: 'seed-feature-dark-mode',
    type: 'feature_request',
    title: 'Add dark mode support',
    description:
      'Multiple users have requested dark mode support for the application. This would reduce eye strain and battery consumption on OLED displays.',
    priority: 'medium',
    upvoteCount: 5,
  },
  {
    id: 'seed-bug-login-timeout',
    type: 'bug',
    title: 'Session expires too quickly during checkout',
    description:
      'Users are getting logged out after just 5 minutes of inactivity, even while in the middle of checkout. This is causing frustration and abandoned carts.',
    priority: 'high',
    upvoteCount: 4,
  },
  {
    id: 'seed-change-nav',
    type: 'change_request',
    title: 'Navigation menu items should be reorganized',
    description:
      'The current navigation structure is confusing. Users suggest moving Settings under Profile and making Search more prominent.',
    priority: 'low',
    upvoteCount: 2,
  },
]

/**
 * Bug report test cases
 */
const bugTestCases: PMEvalTestCase[] = [
  {
    id: 'bug-app-crash-image-upload',
    name: 'App crashes when uploading large images',
    description: 'Clear bug report about application crashing during image upload',
    session: {
      title: 'Image upload crash',
      pageUrl: '/dashboard/media',
      messages: [
        {
          role: 'user',
          content: "Hi, the app keeps crashing when I try to upload photos",
        },
        {
          role: 'assistant',
          content: "I'm sorry to hear that! Can you tell me more about what happens? What size are the images you're trying to upload?",
        },
        {
          role: 'user',
          content: "They're around 15-20MB each. I took them with my DSLR camera. The page just freezes and then Chrome shows the 'Page Unresponsive' error.",
        },
        {
          role: 'assistant',
          content: "Thank you for those details. Are you able to upload smaller images successfully?",
        },
        {
          role: 'user',
          content: "Yes, small images under 5MB work fine. But I need to upload high-res photos for my portfolio. This is really frustrating.",
        },
      ],
    },
    expected: {
      classification: 'bug',
      shouldFindExisting: false,
      issueTitlePattern: 'crash|upload|image|large',
      priority: 'high',
      descriptionKeywords: ['crash', 'upload', '15-20MB', 'freezes'],
    },
    tags: ['classification', 'bug', 'crash'],
  },
  {
    id: 'bug-payment-failed-no-error',
    name: 'Payment fails silently without error message',
    description: 'Bug where payment fails but no error is shown to user',
    session: {
      title: 'Payment issue',
      pageUrl: '/checkout/payment',
      messages: [
        {
          role: 'user',
          content: "I've been trying to pay for my order but nothing happens when I click the button",
        },
        {
          role: 'assistant',
          content: "I understand that's frustrating. When you click the payment button, does anything happen at all? Any loading spinner or message?",
        },
        {
          role: 'user',
          content: "No, literally nothing. The button doesn't even change. But when I check my bank app, I can see the payment was attempted!",
        },
        {
          role: 'assistant',
          content: "That's very concerning. So the payment was processed by your bank but you don't see any confirmation?",
        },
        {
          role: 'user',
          content: "Exactly! It charged my card THREE times because I kept trying. Now I have $300 in pending charges and no order confirmation. This is a serious bug!",
        },
      ],
    },
    expected: {
      classification: 'bug',
      shouldFindExisting: false,
      issueTitlePattern: 'payment|fail|error|silent',
      priority: 'high',
      descriptionKeywords: ['payment', 'charged', 'no confirmation', 'pending'],
    },
    tags: ['classification', 'bug', 'payment', 'critical'],
  },
  {
    id: 'bug-search-wrong-results',
    name: 'Search returns incorrect results',
    description: 'Bug where search functionality returns unrelated results',
    session: {
      title: 'Search not working correctly',
      pageUrl: '/search',
      messages: [
        {
          role: 'user',
          content: "The search is broken. I search for 'laptop' and get results for kitchen appliances",
        },
        {
          role: 'assistant',
          content: "That's strange! Can you tell me exactly what you searched for and what results appeared?",
        },
        {
          role: 'user',
          content: "I typed 'Dell laptop' in the search bar. The first results were a blender, toaster, and coffee maker. No laptops at all.",
        },
        {
          role: 'assistant',
          content: "Thank you for the details. This definitely sounds like a bug. Has this been happening consistently?",
        },
        {
          role: 'user',
          content: "Yes, it's been like this for about a week now. Other searches are weird too.",
        },
      ],
    },
    expected: {
      classification: 'bug',
      shouldFindExisting: false,
      issueTitlePattern: 'search|results|wrong|incorrect',
      priority: 'high',
      descriptionKeywords: ['search', 'wrong results', 'laptop', 'unrelated'],
    },
    tags: ['classification', 'bug', 'search'],
  },
  {
    id: 'bug-duplicate-checkout-safari',
    name: 'Checkout issue on Safari (duplicate of existing)',
    description: 'Similar bug to existing checkout Safari issue - should find duplicate',
    session: {
      title: 'Cannot complete purchase on iPhone',
      pageUrl: '/checkout',
      messages: [
        {
          role: 'user',
          content: "I can't complete my purchase on my iPhone. The checkout button doesn't work.",
        },
        {
          role: 'assistant',
          content: "I'm sorry to hear that. What browser are you using on your iPhone?",
        },
        {
          role: 'user',
          content: "Just Safari, the default browser. I tap the button and nothing happens.",
        },
        {
          role: 'assistant',
          content: "Have you tried refreshing the page or clearing your browser cache?",
        },
        {
          role: 'user',
          content: "Yes, I tried everything. Still doesn't work. The button just won't respond to taps.",
        },
      ],
    },
    expected: {
      classification: 'bug',
      shouldFindExisting: true,
      existingIssueId: 'seed-bug-checkout',
      priority: 'high',
    },
    tags: ['classification', 'bug', 'duplicate', 'safari', 'checkout'],
  },
  {
    id: 'bug-data-loss-autosave',
    name: 'Data lost when autosave fails',
    description: 'Bug where user loses work when autosave fails silently',
    session: {
      title: 'Lost all my work',
      pageUrl: '/editor',
      messages: [
        {
          role: 'user',
          content: "I just lost 2 hours of work!!! The editor didn't save anything!",
        },
        {
          role: 'assistant',
          content: "I'm so sorry to hear that! That must be very frustrating. Can you tell me what happened?",
        },
        {
          role: 'user',
          content: "I was writing a long document. I saw the 'Saving...' message but it never changed to 'Saved'. When my internet dropped briefly, everything was gone.",
        },
        {
          role: 'assistant',
          content: "That's terrible. So the autosave indicator was showing but it wasn't actually saving?",
        },
        {
          role: 'user',
          content: "Exactly! It's been stuck on 'Saving...' for who knows how long. There was no warning that saves were failing. I trusted the autosave feature!",
        },
        {
          role: 'assistant',
          content: "I completely understand your frustration. This sounds like a serious issue with the autosave feature.",
        },
        {
          role: 'user',
          content: "This is unacceptable for a tool I'm paying for. You need to fix this ASAP.",
        },
      ],
    },
    expected: {
      classification: 'bug',
      shouldFindExisting: false,
      issueTitlePattern: 'autosave|data.?loss|save.?fail',
      priority: 'high',
      descriptionKeywords: ['lost work', 'autosave', 'Saving...', 'not saving'],
    },
    tags: ['classification', 'bug', 'data-loss', 'critical'],
  },
]

/**
 * Feature request test cases
 */
const featureRequestTestCases: PMEvalTestCase[] = [
  {
    id: 'feature-export-pdf',
    name: 'Request to export reports as PDF',
    description: 'Clear feature request for PDF export functionality',
    session: {
      title: 'Need PDF export',
      pageUrl: '/reports',
      messages: [
        {
          role: 'user',
          content: "Is there a way to export my reports as PDF? I only see CSV export.",
        },
        {
          role: 'assistant',
          content: "Currently, we only support CSV export. Is PDF export something you'd find useful?",
        },
        {
          role: 'user',
          content: "Yes! I need to share these reports with clients and PDF would look much more professional. The CSV doesn't keep the formatting.",
        },
        {
          role: 'assistant',
          content: "That makes sense. What specific formatting elements would you need in the PDF?",
        },
        {
          role: 'user',
          content: "The charts, the headers, and the summary sections. Basically what I see on screen, just in PDF format. Please add this feature!",
        },
      ],
    },
    expected: {
      classification: 'feature_request',
      shouldFindExisting: false,
      issueTitlePattern: 'pdf|export|report',
      priority: 'medium',
      descriptionKeywords: ['PDF', 'export', 'reports', 'clients', 'formatting'],
    },
    tags: ['classification', 'feature', 'export'],
  },
  {
    id: 'feature-keyboard-shortcuts',
    name: 'Request for keyboard shortcuts',
    description: 'Feature request for productivity-enhancing keyboard shortcuts',
    session: {
      title: 'Keyboard shortcuts',
      pageUrl: '/editor',
      messages: [
        {
          role: 'user',
          content: "I wish this editor had keyboard shortcuts. I keep reaching for my mouse constantly.",
        },
        {
          role: 'assistant',
          content: "What kind of keyboard shortcuts would be most helpful for you?",
        },
        {
          role: 'user',
          content: "Things like Cmd+B for bold, Cmd+S for save, Cmd+K for links. The standard stuff. Also Cmd+/ for comments would be amazing.",
        },
        {
          role: 'assistant',
          content: "Those are great suggestions! We currently have Cmd+S for save, but the others aren't implemented yet.",
        },
        {
          role: 'user',
          content: "Nice that save works! But please add the others. It would make me so much faster. Maybe a customizable shortcuts menu too?",
        },
      ],
    },
    expected: {
      classification: 'feature_request',
      shouldFindExisting: false,
      issueTitlePattern: 'keyboard|shortcut',
      priority: 'medium',
      descriptionKeywords: ['keyboard shortcuts', 'Cmd+B', 'productivity'],
    },
    tags: ['classification', 'feature', 'productivity'],
  },
  {
    id: 'feature-duplicate-dark-mode',
    name: 'Dark mode request (duplicate of existing)',
    description: 'Dark mode request that should match existing feature request',
    session: {
      title: 'Eye strain at night',
      pageUrl: '/settings',
      messages: [
        {
          role: 'user',
          content: "Do you have a dark theme? This white background hurts my eyes when I work at night.",
        },
        {
          role: 'assistant',
          content: "We don't currently have a dark theme. Is this something you'd use regularly?",
        },
        {
          role: 'user',
          content: "Absolutely! I work late hours and the bright white is terrible. Even my phone has dark mode but your app doesn't.",
        },
        {
          role: 'assistant',
          content: "I understand. Dark mode has become a standard feature these days.",
        },
        {
          role: 'user',
          content: "Exactly. Please add it. It would also save battery on my laptop since I have an OLED screen.",
        },
      ],
    },
    expected: {
      classification: 'feature_request',
      shouldFindExisting: true,
      existingIssueId: 'seed-feature-dark-mode',
      priority: 'medium',
    },
    tags: ['classification', 'feature', 'duplicate', 'dark-mode'],
  },
  {
    id: 'feature-api-access',
    name: 'Request for API access',
    description: 'Feature request for developer API',
    session: {
      title: 'API integration question',
      pageUrl: '/integrations',
      messages: [
        {
          role: 'user',
          content: "Hey, is there an API I can use to integrate your service with my internal tools?",
        },
        {
          role: 'assistant',
          content: "We don't currently offer a public API. What kind of integration are you looking for?",
        },
        {
          role: 'user',
          content: "I want to sync data between your platform and our CRM. Right now I have to manually export and import, which takes hours every week.",
        },
        {
          role: 'assistant',
          content: "I see. How often would you need to sync this data?",
        },
        {
          role: 'user',
          content: "Daily, ideally in real-time. We have 10,000+ records. An API would save my team so much time. Even a REST API with basic CRUD would be amazing.",
        },
        {
          role: 'assistant',
          content: "That's valuable feedback. I'll make sure the team knows about this need.",
        },
        {
          role: 'user',
          content: "Please do! We'd pay extra for API access if that helps prioritize it.",
        },
      ],
    },
    expected: {
      classification: 'feature_request',
      shouldFindExisting: false,
      issueTitlePattern: 'api|integration',
      priority: 'high',
      descriptionKeywords: ['API', 'integration', 'CRM', 'sync', 'REST'],
    },
    tags: ['classification', 'feature', 'api', 'integration'],
  },
  {
    id: 'feature-mobile-app',
    name: 'Request for mobile application',
    description: 'Feature request for native mobile app',
    session: {
      title: 'Mobile app?',
      pageUrl: '/',
      messages: [
        {
          role: 'user',
          content: "Do you have a mobile app? The website is hard to use on my phone.",
        },
        {
          role: 'assistant',
          content: "We currently only have a web application. What would you use a mobile app for?",
        },
        {
          role: 'user',
          content: "Quick checks when I'm away from my desk. Just viewing dashboards and responding to notifications. I don't need to create stuff on mobile.",
        },
        {
          role: 'assistant',
          content: "That makes sense. A read-only mobile experience would be useful for you?",
        },
        {
          role: 'user',
          content: "Exactly! Even just that would be great. The mobile web version is clunky - buttons are too small and it's slow.",
        },
      ],
    },
    expected: {
      classification: 'feature_request',
      shouldFindExisting: false,
      issueTitlePattern: 'mobile|app',
      priority: 'medium',
      descriptionKeywords: ['mobile app', 'phone', 'dashboards', 'notifications'],
    },
    tags: ['classification', 'feature', 'mobile'],
  },
]

/**
 * Change request test cases
 */
const changeRequestTestCases: PMEvalTestCase[] = [
  {
    id: 'change-button-placement',
    name: 'Request to move submit button',
    description: 'UX change request for button placement',
    session: {
      title: 'Submit button location',
      pageUrl: '/forms/create',
      messages: [
        {
          role: 'user',
          content: "The submit button is at the top of the form, but I always look for it at the bottom. It's confusing.",
        },
        {
          role: 'assistant',
          content: "I understand. Are you often accidentally missing the submit button?",
        },
        {
          role: 'user',
          content: "Yes! I fill out the whole form, scroll down expecting a submit button, and then have to scroll back up. It breaks the natural flow.",
        },
        {
          role: 'assistant',
          content: "That's valid feedback. Would having the button at the bottom work better for you?",
        },
        {
          role: 'user',
          content: "Definitely. Or maybe have it at both places? But bottom is where everyone expects it.",
        },
      ],
    },
    expected: {
      classification: 'change_request',
      shouldFindExisting: false,
      issueTitlePattern: 'button|submit|placement|position',
      priority: 'low',
      descriptionKeywords: ['submit button', 'bottom', 'UX', 'confusing'],
    },
    tags: ['classification', 'change', 'ux'],
  },
  {
    id: 'change-default-settings',
    name: 'Request to change default settings',
    description: 'Change request for default configuration',
    session: {
      title: 'Default settings are wrong',
      pageUrl: '/settings',
      messages: [
        {
          role: 'user',
          content: "Every time I create a new project, I have to change 5 settings. Can't you make better defaults?",
        },
        {
          role: 'assistant',
          content: "Which settings do you find yourself changing most often?",
        },
        {
          role: 'user',
          content: "Privacy is set to public by default - dangerous! Also the notification settings are too aggressive. And date format is wrong for my region.",
        },
        {
          role: 'assistant',
          content: "Those are good points. Would you prefer if new projects defaulted to private?",
        },
        {
          role: 'user',
          content: "Yes! Privacy should default to private, notifications to 'important only', and date format should detect from browser locale.",
        },
      ],
    },
    expected: {
      classification: 'change_request',
      shouldFindExisting: false,
      issueTitlePattern: 'default|settings|privacy',
      priority: 'medium',
      descriptionKeywords: ['defaults', 'private', 'notifications', 'locale'],
    },
    tags: ['classification', 'change', 'settings'],
  },
  {
    id: 'change-email-frequency',
    name: 'Request to reduce email notifications',
    description: 'Change request for notification behavior',
    session: {
      title: 'Too many emails',
      pageUrl: '/notifications',
      messages: [
        {
          role: 'user',
          content: "I'm getting too many emails from you. Like 20 a day!",
        },
        {
          role: 'assistant',
          content: "I apologize for the email overload. What kind of emails are you receiving?",
        },
        {
          role: 'user',
          content: "Every little thing triggers an email. Someone viewed my profile? Email. Someone liked my post? Email. It's overwhelming.",
        },
        {
          role: 'assistant',
          content: "Have you tried adjusting the notification settings?",
        },
        {
          role: 'user',
          content: "The settings are confusing. There are like 50 toggles. Can't you just have a simple 'Less emails' option or batch them into a daily digest?",
        },
        {
          role: 'assistant',
          content: "A digest option would definitely simplify things.",
        },
        {
          role: 'user',
          content: "Yes! Daily or weekly digest would be perfect instead of individual emails for everything.",
        },
      ],
    },
    expected: {
      classification: 'change_request',
      shouldFindExisting: false,
      issueTitlePattern: 'email|notification|digest',
      priority: 'medium',
      descriptionKeywords: ['emails', 'digest', 'notification', 'batch'],
    },
    tags: ['classification', 'change', 'notifications'],
  },
  {
    id: 'change-duplicate-nav',
    name: 'Navigation reorganization (duplicate of existing)',
    description: 'Nav change request that should match existing',
    session: {
      title: 'Menu is confusing',
      pageUrl: '/',
      messages: [
        {
          role: 'user',
          content: "Where do I find the settings? I looked everywhere.",
        },
        {
          role: 'assistant',
          content: "Settings is under the main menu, then Account, then Settings. I know it's a bit nested.",
        },
        {
          role: 'user',
          content: "That's ridiculous! Three clicks for settings? It should be one click from the main menu.",
        },
        {
          role: 'assistant',
          content: "I understand the frustration. The navigation structure can be improved.",
        },
        {
          role: 'user',
          content: "Also, why is Search hidden under Tools? Nobody looks there for Search. Just put it in the top bar where everyone expects it.",
        },
      ],
    },
    expected: {
      classification: 'change_request',
      shouldFindExisting: true,
      existingIssueId: 'seed-change-nav',
      priority: 'low',
    },
    tags: ['classification', 'change', 'duplicate', 'navigation'],
  },
]

/**
 * Skip test cases - sessions that should NOT create issues
 */
const skipTestCases: PMEvalTestCase[] = [
  {
    id: 'skip-simple-qa',
    name: 'Simple Q&A with resolution',
    description: 'Simple question answered satisfactorily - no issue needed',
    session: {
      title: 'Quick question',
      pageUrl: '/pricing',
      messages: [
        {
          role: 'user',
          content: "What's included in the Pro plan?",
        },
        {
          role: 'assistant',
          content: "The Pro plan includes unlimited projects, priority support, and advanced analytics. You also get team collaboration features and custom branding.",
        },
        {
          role: 'user',
          content: "Perfect, thanks! That's exactly what I needed to know.",
        },
      ],
    },
    expected: {
      classification: 'skip',
      shouldFindExisting: false,
      skipReason: 'Simple Q&A with user satisfaction',
    },
    tags: ['classification', 'skip', 'qa'],
  },
  {
    id: 'skip-short-conversation',
    name: 'Very short conversation',
    description: 'Too few messages to extract meaningful feedback',
    session: {
      title: 'Hello',
      pageUrl: '/',
      messages: [
        {
          role: 'user',
          content: "Hello",
        },
        {
          role: 'assistant',
          content: "Hi there! How can I help you today?",
        },
      ],
    },
    expected: {
      classification: 'skip',
      shouldFindExisting: false,
      skipReason: 'Too few messages',
    },
    tags: ['classification', 'skip', 'short'],
  },
  {
    id: 'skip-off-topic',
    name: 'Off-topic conversation',
    description: 'Conversation not related to product feedback',
    session: {
      title: 'Random chat',
      pageUrl: '/',
      messages: [
        {
          role: 'user',
          content: "What's the weather like today?",
        },
        {
          role: 'assistant',
          content: "I'm a product support assistant, so I can't help with weather information. Is there anything about our product I can help you with?",
        },
        {
          role: 'user',
          content: "No that's fine, I was just wondering. Bye!",
        },
        {
          role: 'assistant',
          content: "Have a great day!",
        },
      ],
    },
    expected: {
      classification: 'skip',
      shouldFindExisting: false,
      skipReason: 'Off-topic conversation',
    },
    tags: ['classification', 'skip', 'off-topic'],
  },
]

/**
 * Edge case test cases
 */
const edgeCaseTestCases: PMEvalTestCase[] = [
  {
    id: 'edge-ambiguous-bug-or-feature',
    name: 'Ambiguous: Could be bug or feature',
    description: 'Session where it is unclear if this is a bug or feature request',
    session: {
      title: 'Filter not working as expected',
      pageUrl: '/dashboard',
      messages: [
        {
          role: 'user',
          content: "The date filter doesn't include today's data",
        },
        {
          role: 'assistant',
          content: "Can you tell me more about what you're seeing? What date range did you select?",
        },
        {
          role: 'user',
          content: "I selected 'Last 7 days' but it shows data from 7 days ago until yesterday. Today's data is missing.",
        },
        {
          role: 'assistant',
          content: "I see. So you expect 'Last 7 days' to include today?",
        },
        {
          role: 'user',
          content: "Of course! 'Last 7 days' should mean today and the 6 days before. That's what every other tool does.",
        },
      ],
    },
    expected: {
      // This is ambiguous - could be classified as bug (not working as expected)
      // or change_request (change the behavior). Accept either.
      classification: 'bug', // Most likely classification based on user expectation
      shouldFindExisting: false,
      issueTitlePattern: 'filter|date|today',
      priority: 'medium',
    },
    tags: ['edge-case', 'ambiguous'],
  },
  {
    id: 'edge-multiple-issues',
    name: 'Session with multiple distinct issues',
    description: 'Session that mentions multiple unrelated issues',
    session: {
      title: 'Several problems',
      pageUrl: '/dashboard',
      messages: [
        {
          role: 'user',
          content: "I have a few issues with your product",
        },
        {
          role: 'assistant',
          content: "I'm happy to help! What issues are you experiencing?",
        },
        {
          role: 'user',
          content: "First, the export feature is broken - it gives me empty files. Second, I wish you had Slack integration. Third, the loading is very slow.",
        },
        {
          role: 'assistant',
          content: "Those are all valid concerns. Let me address each one. For the export issue...",
        },
        {
          role: 'user',
          content: "The export thing is the most critical - I need those reports for my boss by Friday!",
        },
      ],
    },
    expected: {
      // Should focus on the most critical issue (export)
      classification: 'bug',
      shouldFindExisting: false,
      issueTitlePattern: 'export|empty',
      priority: 'high',
      descriptionKeywords: ['export', 'empty files'],
    },
    tags: ['edge-case', 'multiple-issues'],
  },
  {
    id: 'edge-frustrated-but-vague',
    name: 'Frustrated user with vague feedback',
    description: 'User is frustrated but feedback is not actionable',
    session: {
      title: 'Frustrated user',
      pageUrl: '/',
      messages: [
        {
          role: 'user',
          content: "This product is so frustrating to use!",
        },
        {
          role: 'assistant',
          content: "I'm sorry to hear you're frustrated. Can you tell me specifically what's causing the frustration?",
        },
        {
          role: 'user',
          content: "Everything! It's just not intuitive.",
        },
        {
          role: 'assistant',
          content: "I understand. Could you give me an example of something specific that wasn't intuitive?",
        },
        {
          role: 'user',
          content: "I don't know, it's just the overall feeling. Nothing specific, it's just hard to use.",
        },
      ],
    },
    expected: {
      // Vague feedback with no specific actionable items
      classification: 'skip',
      shouldFindExisting: false,
      skipReason: 'Feedback too vague to be actionable',
    },
    tags: ['edge-case', 'vague', 'skip'],
  },
]

/**
 * Complete PM Agent Evaluation Dataset
 */
export const pmEvalDataset: PMEvalDataset = {
  version: '1.0.0',
  description: 'Evaluation dataset for PM Agent session analysis and issue management',
  seedIssues,
  testCases: [
    ...bugTestCases,
    ...featureRequestTestCases,
    ...changeRequestTestCases,
    ...skipTestCases,
    ...edgeCaseTestCases,
  ],
}

/**
 * Helper functions for filtering test cases
 */
export function getTestCasesByTag(tag: string): PMEvalTestCase[] {
  return pmEvalDataset.testCases.filter((tc) => tc.tags.includes(tag))
}

export function getTestCasesByClassification(
  classification: 'bug' | 'feature_request' | 'change_request' | 'skip'
): PMEvalTestCase[] {
  return pmEvalDataset.testCases.filter((tc) => tc.expected.classification === classification)
}

export function getDuplicateTestCases(): PMEvalTestCase[] {
  return pmEvalDataset.testCases.filter((tc) => tc.expected.shouldFindExisting)
}

export function getClassificationTestCases(): PMEvalTestCase[] {
  return pmEvalDataset.testCases.filter(
    (tc) => tc.tags.includes('classification') && !tc.expected.shouldFindExisting
  )
}

export function getEdgeCases(): PMEvalTestCase[] {
  return pmEvalDataset.testCases.filter((tc) => tc.tags.includes('edge-case'))
}

/**
 * Dataset statistics for reporting
 */
export const datasetStats = {
  totalTestCases: pmEvalDataset.testCases.length,
  byClassification: {
    bug: getTestCasesByClassification('bug').length,
    feature_request: getTestCasesByClassification('feature_request').length,
    change_request: getTestCasesByClassification('change_request').length,
    skip: getTestCasesByClassification('skip').length,
  },
  duplicateTestCases: getDuplicateTestCases().length,
  edgeCases: getEdgeCases().length,
  seedIssues: pmEvalDataset.seedIssues.length,
}
