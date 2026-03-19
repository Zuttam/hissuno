import type { SessionTag } from '@/types/session'

export interface DemoSession {
  name: string
  description: string
  tags: SessionTag[]
  status?: 'active' | 'closed' // default: 'active'; sessions with issues are always closed
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
  contactIndex: number | null // index into DEMO_CONTACTS, null = no link
  productScopeIndex: number // index into DEMO_PRODUCT_SCOPES
  issue?: {
    type: 'bug' | 'feature_request' | 'change_request'
    title: string
    description: string
    priority: 'low' | 'medium' | 'high'
    brief?: string
    upvoteCount?: number
    // RICE scores (1-5 scale)
    reach?: number
    impact?: number
    confidence?: number
    effort?: number
    reachReasoning?: string
    confidenceReasoning?: string
    effortEstimate?: string
    effortReasoning?: string
    goalAlignments?: Array<{ goalId: string; reasoning: string }>
    impactReasoning?: string
  }
}

export const DEMO_SESSIONS: DemoSession[] = [
  // ---- 1. Bug: Mobile Safari login crash (Acme Corp / Sarah Chen) ----
  {
    name: 'Login page crashes on mobile Safari',
    description: 'Customer reports login page freezing and reloading on iPhone Safari. The password field tap triggers a crash on iOS 17.2, likely related to autofill or CSS viewport handling.',
    tags: ['bug'],
    contactIndex: 0, // Sarah Chen
    productScopeIndex: 5, // User Management
    messages: [
      { role: 'user', content: 'Hi, I\'m trying to log in on my iPhone but the page keeps crashing in Safari. It works fine on desktop Chrome.' },
      { role: 'assistant', content: 'I\'m sorry to hear you\'re experiencing issues on mobile Safari. Could you tell me which iPhone model and iOS version you\'re using?' },
      { role: 'user', content: 'iPhone 14 Pro, iOS 17.2. The page loads but when I tap the password field it just freezes and then Safari reloads the page.' },
      { role: 'assistant', content: 'Thank you for those details. This sounds like it could be related to our autofill handling on iOS. I\'ve flagged this for our engineering team to investigate. In the meantime, could you try using the "Sign in with Google" option as a workaround?' },
      { role: 'user', content: 'That works, thanks! But please fix the regular login - my team members don\'t all have Google accounts.' },
    ],
    issue: {
      type: 'bug',
      title: 'Login page crashes on mobile Safari (iOS 17+)',
      description: 'The login page freezes and reloads when tapping the password field on iOS Safari. Likely caused by autofill handling interfering with the input focus event. Affects iPhone 14 Pro on iOS 17.2, possibly other devices. Workaround: Sign in with Google.',
      priority: 'high',
      reach: 4, impact: 5, confidence: 4, effort: 2,
      reachReasoning: 'All iOS Safari users (~25% of active user base) are affected when using password login.',
      confidenceReasoning: 'Reproduced consistently on multiple iOS 17 devices. Root cause identified in autofill handler.',
      effortEstimate: '2-3 days',
      effortReasoning: 'Focused fix in the login form autofill handler. Requires iOS-specific event handling and testing on multiple devices.',
      impactReasoning: 'Login is a critical path - users cannot access the product at all when this crashes. Affects all iOS Safari users, roughly 25% of the active user base.',
      brief: '## Fix: Mobile Safari Login Crash\n\n### Problem\nPassword field tap causes page freeze/reload on iOS Safari 17+.\n\n### Root Cause\nAutofill handler conflicts with iOS keyboard focus events.\n\n### Solution\n1. Debounce autofill detection on iOS\n2. Use `inputmode="text"` with manual password toggle\n3. Add iOS-specific focus event handling\n\n### Testing\n- iPhone 14 Pro, iOS 17.2\n- iPhone 13, iOS 17.1\n- iPad Pro, iPadOS 17',
      upvoteCount: 4,
    },
  },

  // ---- 2. Feature Request: Bulk CSV export (Initech / David Park) ----
  {
    name: 'Feature request: Bulk export to CSV',
    description: 'Customer needs to export filtered task lists and project data to CSV for executive reporting. Currently limited to exporting one view at a time with no column selection.',
    tags: ['feature_request'],
    contactIndex: 4, // David Park
    productScopeIndex: 3, // Reporting & Analytics
    messages: [
      { role: 'user', content: 'Is there a way to export all our project data to CSV? We need to share reports with stakeholders who don\'t have access to Acme Workspace.' },
      { role: 'assistant', content: 'Currently we support exporting individual task lists. Are you looking to export all tasks at once, or a filtered subset?' },
      { role: 'user', content: 'Ideally a filtered subset - like all tasks from the last quarter tagged as "blocked". We do quarterly reviews and need to pull data for different time ranges and statuses.' },
      { role: 'assistant', content: 'That makes a lot of sense. I\'ll pass this along as a feature request. Being able to bulk export filtered tasks with date ranges and status filters would be very useful for reporting workflows.' },
      { role: 'user', content: 'Exactly. Even a simple CSV with task name, assignee, status, and dates would be incredibly helpful. Thanks!' },
    ],
    issue: {
      type: 'feature_request',
      title: 'Bulk CSV export with date range and status filters',
      description: 'Users need the ability to export filtered subsets of tasks to CSV for quarterly reviews. Should support filtering by date range, status, and tags. Currently only individual task list export is available.',
      priority: 'medium',
      reach: 3, impact: 3, confidence: 4, effort: 3,
      reachReasoning: 'Requested by teams doing quarterly reviews. Estimated 30-40% of Pro/Enterprise accounts would use this regularly.',
      confidenceReasoning: 'Clear requirements from multiple customer conversations. Standard feature in competitor products.',
      effortEstimate: '1-2 weeks',
      effortReasoning: 'Needs filter UI, CSV generation pipeline, and background job for large exports. Moderate complexity.',
      impactReasoning: 'Directly enables non-technical users to pull their own data without engineering help. Removes a key blocker for self-serve reporting workflows.',
      goalAlignments: [{ goalId: 'ra-g1', reasoning: 'CSV export is a foundational self-serve reporting capability that lets non-technical users extract data without engineering support.' }],
      brief: '## Feature: Bulk CSV Export\n\n### Overview\nAllow users to export filtered task data to CSV for reporting.\n\n### Requirements\n- Filter by date range, tags, status, and assignee\n- Columns: task name, assignee, status, dates, priority\n- Max 10,000 rows per export\n- Background job for large exports with email notification\n\n### UX\n1. Add "Export" button to task list toolbar\n2. Show filter summary before export\n3. Download starts automatically\n\n### API\n`POST /api/projects/:id/exports` with filter params, returns CSV stream.',
      upvoteCount: 7,
    },
  },

  // ---- 3. Change Request: API rate limits (NovaTech / Alex Rivera) ----
  {
    name: 'API rate limits too restrictive for our use case',
    description: 'Enterprise customer hitting API rate limits during CI/CD deployment windows with 500+ calls per minute. Batch endpoint helps but base limits need to be higher for Enterprise plans.',
    tags: ['change_request'],
    contactIndex: 10, // Alex Rivera
    productScopeIndex: 4, // Integrations & API
    messages: [
      { role: 'user', content: 'We\'re hitting the API rate limit when syncing task data from our CI/CD pipeline. We process about 500 updates per minute during deployment windows.' },
      { role: 'assistant', content: 'I understand the rate limit is impacting your workflow. Could you share more about your integration setup? Specifically, are you using batch endpoints or individual requests?' },
      { role: 'user', content: 'Individual requests right now. We didn\'t see a batch endpoint in the docs. Is there one?' },
      { role: 'assistant', content: 'We do have a batch endpoint at /api/v2/tasks/batch that accepts up to 100 updates per request. That should significantly reduce the number of API calls. I\'ll also flag your use case to our team - 500 updates/minute is a valid enterprise workflow.' },
      { role: 'user', content: 'Oh great, the batch endpoint helps. But it would still be nice to have higher limits for Enterprise plans. We\'re paying a premium after all.' },
    ],
    issue: {
      type: 'change_request',
      title: 'Increase API rate limits for Enterprise plans',
      description: 'Enterprise customers are hitting rate limits during CI/CD deployment windows with 500+ API calls/minute. Current limits are too restrictive for legitimate automation use cases. Batch endpoint helps but higher base limits would provide a better developer experience.',
      priority: 'medium',
      reach: 2, impact: 3, confidence: 5, effort: 2,
      reachReasoning: 'Affects heavy API consumers on Enterprise plans. Estimated 15-20% of Enterprise accounts hit limits regularly.',
      confidenceReasoning: 'Multiple Enterprise customers have reported this. Clear correlation between plan tier and API usage patterns.',
      effortEstimate: '3-5 days',
      effortReasoning: 'Rate limiter configuration change plus load testing to validate new thresholds. Low code complexity but requires careful capacity planning.',
      impactReasoning: 'Rate limit errors during CI/CD windows cause deployment failures and erode developer trust. Fixing this directly supports API reliability targets.',
      goalAlignments: [{ goalId: 'ia-g2', reasoning: 'Appropriate rate limits prevent cascading failures during high-traffic windows, supporting the 99.9% uptime and latency targets.' }],
      upvoteCount: 3,
    },
  },

  // ---- 4. General Feedback + Win: Dashboard redesign (Acme / Marcus Johnson) ----
  {
    name: 'Love the new dashboard redesign!',
    description: 'Positive feedback on the new project dashboard and workload view. PM team finds the capacity vs. actual assignments view useful for correlating with sprint velocity.',
    tags: ['general_feedback', 'wins'],
    status: 'closed',
    contactIndex: 1, // Marcus Johnson
    productScopeIndex: 3, // Reporting & Analytics
    messages: [
      { role: 'user', content: 'Just wanted to say the new project dashboard is fantastic! The workload view makes it so much easier to spot overallocated team members. My PM team loves it.' },
      { role: 'assistant', content: 'Thank you so much for the kind words! We put a lot of work into the workload view. Is there anything specific about it that your team finds most useful?' },
      { role: 'user', content: 'The ability to see capacity vs. actual assignments over time is great. We can actually correlate it with sprint velocity and see if changes improved or worsened the team\'s output. Really powerful stuff.' },
    ],
  },

  // ---- 5. Bug: Webhook timeouts (NovaTech / Alex Rivera) ----
  {
    name: 'Webhook delivery failing intermittently',
    description: 'Customer reports ~30% of webhook events never arriving. Root cause identified as timeout-based failures not triggering retry logic - only 5xx responses are retried.',
    tags: ['bug'],
    contactIndex: 10, // Alex Rivera
    productScopeIndex: 4, // Integrations & API
    messages: [
      { role: 'user', content: 'Our webhook endpoint has been receiving about 70% of task events since yesterday. We\'re not seeing any errors on our end - the missing events just never arrive.' },
      { role: 'assistant', content: 'I can look into this for you. Could you share your webhook endpoint URL (or the last few characters) and the approximate timeframe when you noticed the failures?' },
      { role: 'user', content: 'The endpoint ends in /webhooks/acme-workspace. Started noticing around 3pm UTC yesterday. Our server logs show no incoming requests for the missing events.' },
      { role: 'assistant', content: 'I\'ve checked our delivery logs and it looks like those events are failing with a timeout. Your endpoint might be taking longer than our 10-second timeout to respond during peak hours. Could you check if there\'s any processing happening synchronously in your webhook handler?' },
      { role: 'user', content: 'Ah, yes - we were doing database writes synchronously. We\'ll queue those instead. But 10 seconds seems short, could you increase the timeout or add retry logic?' },
      { role: 'assistant', content: 'We do retry failed deliveries up to 3 times with exponential backoff, but only for 5xx responses - timeouts currently aren\'t retried. I\'ll flag this as a bug since timeouts should definitely trigger retries too.' },
    ],
    issue: {
      type: 'bug',
      title: 'Webhook timeouts not retried (only 5xx responses trigger retry)',
      description: 'Webhook delivery retries only trigger for 5xx HTTP responses. Timeouts (10s limit) silently fail without retries, causing ~30% event loss for endpoints with slower processing. Should treat timeouts as retriable failures with the same exponential backoff logic.',
      priority: 'high',
      reach: 3, impact: 5, confidence: 5, effort: 1,
      reachReasoning: 'All customers using webhook integrations are potentially affected. ~30% of API-active accounts use webhooks.',
      confidenceReasoning: 'Bug confirmed in delivery logs. Root cause clearly identified - timeout events not classified as retriable.',
      effortEstimate: '1-2 days',
      effortReasoning: 'Small change to webhook retry logic to treat timeouts the same as 5xx errors. Well-scoped fix.',
      impactReasoning: 'Silent event loss undermines webhook reliability. Customers building automation on webhooks lose ~30% of events, causing data sync gaps and broken workflows.',
      goalAlignments: [{ goalId: 'ia-g2', reasoning: 'Fixing silent timeout failures directly improves API reliability and reduces event loss, supporting the 99.9% uptime target.' }],
      upvoteCount: 5,
    },
  },

  // ---- 6. Bug: Task dependencies not updating (Initech / Priya Sharma) ----
  {
    name: 'Task dependencies not updating when parent is rescheduled',
    description: 'Rescheduling a parent task in timeline view does not cascade date changes to dependent child tasks. Works correctly in list view. Blocking issue for teams managing complex project dependency chains.',
    tags: ['bug'],
    contactIndex: 5, // Priya Sharma
    productScopeIndex: 1, // Task Management
    messages: [
      { role: 'user', content: 'When we reschedule a parent task on the timeline view, the dependent tasks don\'t shift automatically. This is causing scheduling conflicts across our projects.' },
      { role: 'assistant', content: 'That\'s definitely not the expected behavior. When you say "dependent tasks don\'t shift," are you seeing the dependencies stay in place visually, or is the actual due date data not changing?' },
      { role: 'user', content: 'Both. The dependency arrows still show, but the child tasks keep their original dates. So we end up with child tasks starting before the parent is finished. Very confusing for the team.' },
      { role: 'assistant', content: 'I can reproduce this. It looks like the cascade rescheduling only works in the list view, not the timeline view. I\'ll escalate this to the engineering team as a high-priority bug.' },
      { role: 'user', content: 'Please do. We manage 50+ projects with complex dependencies. Having to manually update every downstream task is a dealbreaker for us.' },
    ],
    issue: {
      type: 'bug',
      title: 'Timeline view: rescheduling parent task does not cascade to dependent tasks',
      description: 'In timeline view, dragging a parent task to a new date does not automatically shift dependent (child) tasks. Dependency arrows remain but child task dates are unchanged, creating impossible scheduling. Works correctly in list view. Affects teams with complex task dependency chains.',
      priority: 'high',
      reach: 4, impact: 4, confidence: 5, effort: 3,
      reachReasoning: 'Affects all teams using timeline view with task dependencies. Core workflow for project managers.',
      confidenceReasoning: 'Reproduced consistently. Root cause identified - timeline drag handler bypasses cascade logic.',
      effortEstimate: '1 week',
      effortReasoning: 'Requires extracting cascade logic into shared function and integrating with timeline drag handler. Moderate refactoring plus visual feedback work.',
      impactReasoning: 'Breaking dependency chains blocks downstream tasks and delays project milestones. High impact on teams using dependency-heavy workflows.',
      goalAlignments: [{ goalId: 'tm-g1', reasoning: 'Automatic dependency cascading eliminates manual rescheduling overhead, directly reducing average task completion time.' }],
      brief: '## Fix: Timeline Dependency Cascade\n\n### Problem\nRescheduling a parent task in timeline view does not cascade date changes to dependent tasks.\n\n### Root Cause\nThe timeline drag handler calls `updateTaskDate()` directly without triggering the dependency cascade logic that the list view uses.\n\n### Solution\n1. Extract cascade logic from list view into shared `cascadeDependencyDates()` function\n2. Call it from both list view and timeline view after date updates\n3. Add visual feedback showing which tasks will shift before confirming\n\n### Testing\n- Create chain: Task A > Task B > Task C with dependencies\n- Reschedule Task A in timeline view\n- Verify Task B and C shift by the same delta\n- Verify undo works correctly for cascaded changes',
      upvoteCount: 6,
    },
  },

  // ---- 7. Feature Request: Gantt chart export (Sterling / Victoria Adams) ----
  {
    name: 'Need Gantt chart export for client presentations',
    description: 'Compliance team needs to export timeline/Gantt view as clean PDF for regulator presentations. Current browser print-to-PDF includes UI elements and is not presentation-ready.',
    tags: ['feature_request'],
    contactIndex: 15, // Victoria Adams
    productScopeIndex: 3, // Reporting & Analytics
    messages: [
      { role: 'user', content: 'Our compliance team needs to present project timelines to regulators. Is there a way to export the timeline view as a PDF or PowerPoint?' },
      { role: 'assistant', content: 'Currently you can take a screenshot or use browser print-to-PDF, but we don\'t have a native export. What format would be most useful for your compliance presentations?' },
      { role: 'user', content: 'PDF would be ideal. It needs to look clean - no UI chrome, just the Gantt chart with task names, dates, and dependencies. We do these presentations quarterly to the OCC.' },
      { role: 'assistant', content: 'Understood. A clean, presentation-ready PDF export of the timeline would be a great addition. I\'ll submit this as a feature request. For now, I\'d suggest using the browser print function with the sidebar collapsed - it gives a cleaner result.' },
    ],
    issue: {
      type: 'feature_request',
      title: 'Export timeline/Gantt view as presentation-ready PDF',
      description: 'Enterprise customers need to share project timelines with external stakeholders (regulators, clients) in clean PDF format. Current workaround is browser print-to-PDF which includes UI elements. Need a dedicated export that produces clean Gantt charts with task names, dates, dependencies, and milestones.',
      priority: 'medium',
      reach: 2, impact: 4, confidence: 3, effort: 4,
      reachReasoning: 'Primarily Enterprise customers in regulated industries. ~10-15% of Enterprise accounts need this for external reporting.',
      confidenceReasoning: 'Strong demand from regulated industries but unclear how many other customers would use it regularly.',
      effortEstimate: '2-3 weeks',
      effortReasoning: 'Requires server-side PDF rendering of timeline view, handling large projects, and ensuring visual fidelity. Significant frontend and backend work.',
      impactReasoning: 'External stakeholders (regulators, clients) need clean Gantt exports. Currently blocked by browser print artifacts. Enables self-serve reporting for a high-value use case.',
      goalAlignments: [{ goalId: 'ra-g1', reasoning: 'PDF export lets non-technical stakeholders generate presentation-ready reports without developer assistance.' }],
      upvoteCount: 4,
    },
  },

  // ---- 8. Bug: Mobile app notifications delayed (Meridian Health / Kevin O'Brien) ----
  {
    name: 'Mobile push notifications delayed by 10+ minutes',
    description: 'Android push notifications consistently delayed 10-30 minutes due to notification batching for battery optimization. iOS works fine. Critical issue for healthcare teams where task delays have real consequences.',
    tags: ['bug'],
    contactIndex: 9, // Kevin O'Brien
    productScopeIndex: 6, // Mobile App
    messages: [
      { role: 'user', content: 'Our team is getting push notifications on the mobile app anywhere from 10 to 30 minutes late. This is really problematic for urgent tasks in a healthcare setting.' },
      { role: 'assistant', content: 'I understand the urgency, especially in healthcare. Are you seeing this on iOS, Android, or both? And is it happening for all notification types or specific ones?' },
      { role: 'user', content: 'Primarily Android. iOS seems fine, maybe 1-2 minute delay at most. On Android it\'s consistently 10+ minutes. We\'ve checked - background app refresh is enabled and battery optimization is turned off for the app.' },
      { role: 'assistant', content: 'Thank you for testing those settings. This sounds like it could be related to our push notification batching on Android - we aggregate notifications to reduce battery impact. I\'ll flag this for the mobile team to investigate whether we can add an "urgent" category that bypasses batching.' },
      { role: 'user', content: 'That would be critical for us. In healthcare, a 10-minute delay on a task assignment could have real consequences. Please make this a priority.' },
    ],
    issue: {
      type: 'bug',
      title: 'Android push notifications delayed 10-30 minutes due to batching',
      description: 'Push notifications on Android are consistently delayed 10-30 minutes. Root cause appears to be notification batching for battery optimization. iOS notifications arrive within 1-2 minutes. Critical for healthcare and other time-sensitive use cases. Need to add urgent notification category that bypasses batching.',
      priority: 'high',
      reach: 3, impact: 4, confidence: 4, effort: 3,
      reachReasoning: 'All Android mobile app users affected. Android represents ~40% of mobile user base.',
      confidenceReasoning: 'Confirmed via internal testing. Batching behavior documented in Android push notification SDK.',
      effortEstimate: '1-2 weeks',
      effortReasoning: 'Requires implementing notification priority categories in Android SDK, server-side priority routing, and testing across Android versions.',
      impactReasoning: 'Delayed notifications in time-sensitive industries like healthcare create real operational risk. A top complaint driving negative Android reviews.',
      goalAlignments: [{ goalId: 'ma-g2', reasoning: 'Notification delays are the #1 driver of negative Android app reviews. Fixing this directly protects the App Store rating.' }],
      upvoteCount: 3,
    },
  },

  // ---- 9. General Feedback: Onboarding experience (Globex / Elena Kowalski) ----
  {
    name: 'Onboarding was smooth but templates could be better',
    description: 'Fintech customer found onboarding flow smooth but project templates too generic. Needs industry-specific templates with compliance gates and regulatory checkpoints for sprint planning.',
    tags: ['general_feedback'],
    contactIndex: 2, // Elena Kowalski
    productScopeIndex: 0, // General
    messages: [
      { role: 'user', content: 'Just finished setting up our Acme Workspace instance. The onboarding flow was pretty smooth overall, but the project templates felt generic. We\'re a fintech company and none of the templates really fit our workflows.' },
      { role: 'assistant', content: 'Thank you for that feedback! Could you tell me more about what kind of templates would be useful for your fintech workflows?' },
      { role: 'user', content: 'Things like sprint planning with regulatory checkpoints, compliance review workflows, and audit trail templates. The "Software Development" template was the closest but it doesn\'t account for compliance gates between stages.' },
      { role: 'assistant', content: 'That\'s really helpful. Industry-specific templates with compliance-aware workflows would definitely be valuable for fintech teams. I\'ll share this with our product team.' },
    ],
  },

  // ---- 10. Win: Team collaboration features (BrightPath / Michael Foster) ----
  {
    name: 'Real-time collaboration saved our remote team',
    description: 'Remote team of 45 across 3 time zones reports 30% reduction in meetings after adopting real-time commenting and mentions. Previously used spreadsheets and email. Open to case study.',
    tags: ['wins'],
    status: 'closed',
    contactIndex: 12, // Michael Foster
    productScopeIndex: 2, // Team Collaboration
    messages: [
      { role: 'user', content: 'I just wanted to share some positive feedback. Since we switched to Acme Workspace, our remote team\'s collaboration has improved dramatically. The real-time commenting and @mentions keep everyone in the loop.' },
      { role: 'assistant', content: 'That\'s wonderful to hear! How large is your remote team, and what were you using before?' },
      { role: 'user', content: 'We have 45 people across 3 time zones. We were using a mix of spreadsheets and email before. The fact that we can comment on tasks and see updates in real-time means no more "check your email" messages. Our meeting time has dropped by 30%.' },
      { role: 'assistant', content: 'A 30% reduction in meetings is a fantastic result! We love hearing stories like this. Would you be open to being featured in a case study? We think other education organizations could benefit from your experience.' },
      { role: 'user', content: 'Sure, I\'d be happy to. Just have someone reach out to schedule it.' },
    ],
  },

  // ---- 11. Feature Request: Custom fields on board cards (Initech / Rachel Torres) ----
  {
    name: 'Custom fields not visible on board view cards',
    description: 'Board view cards only show fixed fields. Agile teams want Story Points and Sprint custom fields visible on Kanban cards without clicking into each task. Requesting configurable card layout per project.',
    tags: ['feature_request'],
    contactIndex: 6, // Rachel Torres
    productScopeIndex: 1, // Task Management
    messages: [
      { role: 'user', content: 'We\'ve set up custom fields for "Story Points" and "Sprint" but they don\'t show on the board view cards. We have to click into each task to see them. Can you add those to the card display?' },
      { role: 'assistant', content: 'Good suggestion! Currently board cards show title, assignee, priority, and due date. Which custom fields are most important for your team to see at a glance?' },
      { role: 'user', content: 'Story Points and Sprint are the top two. But ideally we\'d want to choose which custom fields appear on cards - every team has different priorities. Maybe a "card layout" setting per project?' },
      { role: 'assistant', content: 'A configurable card layout is a great idea - it would let each team customize the board to their workflow. I\'ll submit this as a feature request with your use case.' },
    ],
    issue: {
      type: 'feature_request',
      title: 'Configurable custom fields on board view cards',
      description: 'Board view cards only show fixed fields (title, assignee, priority, due date). Users want to configure which custom fields appear on cards. Use case: showing Story Points and Sprint on Kanban cards for agile teams. Should be a per-project setting under board view configuration.',
      priority: 'medium',
      reach: 4, impact: 3, confidence: 4, effort: 3,
      reachReasoning: 'Most teams use board view and custom fields. Broad demand across plan tiers.',
      confidenceReasoning: 'Consistent feedback from agile teams. 8 upvotes indicates strong cross-customer demand.',
      effortEstimate: '1-2 weeks',
      effortReasoning: 'Requires card layout configuration UI, per-project settings storage, and dynamic card rendering. Moderate complexity.',
      impactReasoning: 'Custom fields on cards reduce the need to open task details, enabling faster board scanning for large teams working concurrently.',
      goalAlignments: [{ goalId: 'tm-g2', reasoning: 'Configurable card layouts improve board usability for large teams, supporting the goal of 50+ concurrent collaborators per board.' }],
      upvoteCount: 8,
    },
  },

  // ---- 12. Bug: SSO session expiry (Sterling / Robert Kim) ----
  {
    name: 'SSO sessions expiring every 30 minutes',
    description: 'SAML SSO sessions expire after 30 minutes despite IdP (Okta) being configured for 12 hours. SessionNotOnOrAfter assertion not being parsed correctly. Causing 550 users to lose unsaved work during re-auth.',
    tags: ['bug'],
    contactIndex: 16, // Robert Kim
    productScopeIndex: 5, // User Management
    messages: [
      { role: 'user', content: 'Since we configured SAML SSO last week, our users are being forced to re-authenticate every 30 minutes. Our IdP (Okta) has a 12-hour session configured, so this seems to be on your end.' },
      { role: 'assistant', content: 'That\'s definitely too aggressive. Let me check your SSO configuration. What\'s your workspace ID?' },
      { role: 'user', content: 'It\'s sterling-financial. We have 550 employees and this is generating a lot of complaints. People are losing work in progress when the session expires mid-edit.' },
      { role: 'assistant', content: 'I found the issue - there\'s a misconfiguration in how we\'re reading the SessionNotOnOrAfter assertion from your IdP response. We\'re using a 30-minute default instead of honoring Okta\'s 12-hour setting. I\'m escalating this to engineering now.' },
      { role: 'user', content: 'Thank you. Can you also look into preserving draft state when a re-auth happens? Even after this is fixed, occasional re-auths shouldn\'t lose unsaved work.' },
    ],
    issue: {
      type: 'bug',
      title: 'SAML SSO ignores IdP session duration, defaults to 30-minute expiry',
      description: 'SSO sessions expire after 30 minutes regardless of the IdP-configured session length. The SessionNotOnOrAfter SAML assertion attribute is not being read correctly. Affects all SSO customers. Secondary issue: re-authentication causes loss of unsaved work.',
      priority: 'high',
      reach: 3, impact: 5, confidence: 5, effort: 2,
      reachReasoning: 'All Enterprise customers using SSO (~100% of Enterprise accounts). 550+ users at Sterling alone.',
      confidenceReasoning: 'Root cause identified in SAML parser. Confirmed with Okta and Azure AD configurations.',
      effortEstimate: '3-5 days',
      effortReasoning: 'SAML parser fix is straightforward. Session warning and draft preservation are additional but well-scoped tasks.',
      impactReasoning: 'Forced re-authentication every 30 minutes disrupts all 550+ SSO users and causes data loss. Critical for Enterprise retention.',
      brief: '## Fix: SAML Session Duration\n\n### Problem\nSSO sessions expire every 30 minutes instead of honoring the IdP session duration.\n\n### Root Cause\nSAML response parser is not reading the `SessionNotOnOrAfter` attribute. Falls back to hardcoded 30-minute default.\n\n### Solution\n1. Parse `SessionNotOnOrAfter` from SAML assertion\n2. Use parsed value for session expiry, with 12-hour max cap\n3. Add "session about to expire" warning 5 minutes before expiry\n4. Auto-save form state before redirect to re-auth\n\n### Testing\n- Test with Okta (12h session)\n- Test with Azure AD (8h session)\n- Test session expiry warning timing\n- Test draft preservation across re-auth',
      upvoteCount: 5,
    },
  },

  // ---- 13. Change Request: Notification preferences (Meridian Health / Dr. Lisa Chang) ----
  {
    name: 'Need more granular notification controls',
    description: 'Healthcare team overwhelmed by all-or-nothing notifications. Needs per-category controls: real-time for mentions and own task changes, daily/weekly digest for everything else.',
    tags: ['change_request'],
    contactIndex: 8, // Dr. Lisa Chang
    productScopeIndex: 0, // General
    messages: [
      { role: 'user', content: 'We need better notification controls. Right now it\'s either "all notifications" or "none." Our doctors are getting pinged for every comment on every task in their projects.' },
      { role: 'assistant', content: 'I understand - notification overload is counterproductive. What level of granularity would work for your team?' },
      { role: 'user', content: 'Ideally: notify me only when I\'m @mentioned, when a task assigned to me changes status, or when a task I\'m watching hits a deadline. Everything else should be a digest or silent.' },
      { role: 'assistant', content: 'Those are very reasonable notification rules. We\'re actually working on a more granular notification system. Would a weekly digest email for non-urgent updates work alongside real-time alerts for the categories you mentioned?' },
      { role: 'user', content: 'That would be perfect. A daily or weekly digest for general updates, and real-time only for direct mentions and my own task changes.' },
    ],
    issue: {
      type: 'change_request',
      title: 'Granular notification preferences with digest option',
      description: 'Users want per-category notification controls: real-time for @mentions and own task changes, digest for everything else. Current system is all-or-nothing. Needed especially for users in high-activity workspaces who get notification fatigue. Should support daily/weekly digest frequency.',
      priority: 'medium',
      reach: 5, impact: 3, confidence: 4, effort: 4,
      reachReasoning: 'Notification fatigue affects nearly all users in active workspaces. Universal pain point.',
      confidenceReasoning: 'Consistent demand across customer segments. Clear requirements from multiple conversations.',
      effortEstimate: '2-3 weeks',
      effortReasoning: 'Requires notification preferences UI, per-category routing logic, digest aggregation service, and email template work.',
      upvoteCount: 6,
    },
  },

  // ---- 14. Bug: Calendar view timezone issue (Quantum Analytics / Chris Nakamura) ----
  {
    name: 'Calendar view showing tasks on wrong day',
    description: 'Calendar view renders task dates using UTC midnight boundaries instead of user timezone. Tasks appear on the wrong day for users in positive UTC offsets like AEST.',
    tags: ['bug'],
    contactIndex: 14, // Chris Nakamura
    productScopeIndex: 1, // Task Management
    messages: [
      { role: 'user', content: 'Tasks due on Friday are showing up on Thursday in my calendar view. I\'m in AEST (UTC+10). It seems like the calendar is rendering dates in UTC instead of my local timezone.' },
      { role: 'assistant', content: 'That sounds like a timezone rendering issue. Could you confirm - when you click on the task, does the detail view show the correct date (Friday)?' },
      { role: 'user', content: 'Yes! The task detail says Friday, March 7. But on the calendar grid it\'s sitting on Thursday, March 6. My timezone is set correctly in my profile settings.' },
      { role: 'assistant', content: 'I can confirm this is a known bug that affects users east of UTC. The calendar grid is using UTC midnight as the day boundary instead of your local midnight. We have a fix in progress for the next release.' },
    ],
    issue: {
      type: 'bug',
      title: 'Calendar view renders dates in UTC instead of user timezone',
      description: 'Calendar view grid uses UTC midnight for day boundaries instead of the user\'s local timezone. Tasks appear on the wrong day for users in positive UTC offsets (e.g., AEST shows Friday tasks on Thursday). Task detail views show correct dates. Fix needed in the calendar rendering layer.',
      priority: 'medium',
      reach: 3, impact: 3, confidence: 5, effort: 2,
      reachReasoning: 'Affects all users in positive UTC offsets using calendar view. Concentrated in APAC region (~20% of user base).',
      confidenceReasoning: 'Bug is deterministic and reproducible. Root cause clearly identified in calendar rendering layer.',
      effortEstimate: '2-3 days',
      effortReasoning: 'Localized fix in calendar grid rendering to use user timezone for day boundaries. Well-scoped.',
    },
  },

  // ---- 15. Feature Request: Slack integration improvements (Acme / Sarah Chen) ----
  {
    name: 'Slack integration missing two-way sync',
    description: 'Current Slack integration is one-way notifications only. Engineers want to reply, react with emoji to change status, and create tasks via slash commands without leaving Slack.',
    tags: ['feature_request'],
    contactIndex: 0, // Sarah Chen
    productScopeIndex: 4, // Integrations & API
    messages: [
      { role: 'user', content: 'Our Slack integration only pushes notifications from Acme Workspace to Slack. Can we get two-way sync so that replying to a notification in Slack creates a comment on the task?' },
      { role: 'assistant', content: 'Currently the Slack integration is one-way (notifications only). Two-way sync is something we\'ve been considering. What specific actions would you want to perform from Slack?' },
      { role: 'user', content: 'Reply to create comments, react with emoji to change status (like thumbs-up to mark complete), and slash commands to create tasks from Slack. Our engineers live in Slack and context-switching to the web app breaks their flow.' },
      { role: 'assistant', content: 'Those are great use cases. Reducing context switching between Slack and Acme Workspace would definitely improve adoption for engineering teams. I\'ll add your specific scenarios to the feature request.' },
    ],
    issue: {
      type: 'feature_request',
      title: 'Two-way Slack integration with comments, reactions, and slash commands',
      description: 'Current Slack integration is one-way (notifications only). Engineers want to reply to create task comments, use emoji reactions to change task status, and create tasks via slash commands - all without leaving Slack. Key for reducing context switching for engineering-heavy teams.',
      priority: 'high',
      reach: 5, impact: 4, confidence: 4, effort: 5,
      reachReasoning: 'Slack is the primary communication tool for ~60% of customers. Highest-voted feature request.',
      confidenceReasoning: '9 upvotes and consistent demand from engineering-heavy teams. Clear use cases defined.',
      effortEstimate: '4-6 weeks',
      effortReasoning: 'Major integration effort: Slack app manifest, event subscriptions, slash commands, reaction handlers, comment sync, and bidirectional state management.',
      impactReasoning: 'Slack is where ~60% of customers spend their day. Two-way sync eliminates the biggest context-switching friction and is the highest-voted feature request.',
      goalAlignments: [{ goalId: 'ia-g1', reasoning: 'A full two-way Slack integration counts as a major native integration milestone toward the 25-integration target.' }],
      upvoteCount: 9,
    },
  },

  // ---- 16. Loss: Umbrella Labs churning (Tom Mueller) ----
  {
    name: 'We\'re canceling our subscription',
    description: 'Small biotech startup churning because the tool is overkill for a 15-person team. API access locked to higher tiers blocks their LIMS integration. Onboarding docs assume PM expertise.',
    tags: ['losses'],
    status: 'closed',
    contactIndex: 7, // Tom Mueller
    productScopeIndex: 0, // General
    messages: [
      { role: 'user', content: 'We need to cancel our Acme Workspace subscription effective end of this month.' },
      { role: 'assistant', content: 'I\'m sorry to hear that. Would you mind sharing what led to this decision? Your feedback would really help us improve.' },
      { role: 'user', content: 'Honestly, for a 15-person biotech startup, the tool is overkill. We don\'t use 80% of the features and the Starter plan doesn\'t include the one thing we actually need - the API access for our LIMS integration.' },
      { role: 'assistant', content: 'That\'s really valuable feedback. API access being limited to higher tiers is something we\'ve heard from other small teams. Is there anything else that contributed to the decision?' },
      { role: 'user', content: 'The onboarding was also rough. It took us 3 weeks to get everyone set up because the docs assume you already know project management tools. We\'re scientists, not PMs. We just needed simple task tracking with an API.' },
    ],
  },

  // ---- 17. Win: Enterprise deployment (Initech / David Park) ----
  {
    name: 'Successful rollout to 400+ users',
    description: 'Enterprise customer completed rollout to 420 employees with 94% adoption in the first month. SSO integration, project templates, and API sync with internal tools drove adoption. Open to conference speaking.',
    tags: ['wins', 'general_feedback'],
    status: 'closed',
    contactIndex: 4, // David Park
    productScopeIndex: 0, // General
    messages: [
      { role: 'user', content: 'Just wanted to let you know we completed the Acme Workspace rollout to all 420 employees last week. Adoption rate is at 94% after the first month.' },
      { role: 'assistant', content: 'That\'s an incredible adoption rate! What do you think drove such high adoption?' },
      { role: 'user', content: 'Three things: the SSO integration made onboarding frictionless, the project templates we set up matched our existing workflows, and the API let us sync with our internal tools. Your customer success team was also fantastic during the pilot phase.' },
      { role: 'assistant', content: 'Thank you for sharing that! 94% adoption at 420 users in the first month is really exceptional. Would your team be interested in speaking at our next customer conference?' },
      { role: 'user', content: 'David would probably be up for it. Have your events team reach out to coordinate schedules.' },
    ],
  },

  // ---- 18. Bug: File preview broken (BrightPath / Nina Patel) ----
  {
    name: 'PDF previews not loading in task attachments',
    description: 'PDF file previews show infinite spinner for files larger than 5 MB. Smaller PDFs and other file types work fine. Regression from approximately one week ago, likely related to PDF rendering service memory limits.',
    tags: ['bug'],
    contactIndex: 13, // Nina Patel
    productScopeIndex: 2, // Team Collaboration
    messages: [
      { role: 'user', content: 'When we attach PDFs to tasks, the preview just shows a spinning loader forever. We have to download the file to view it. This started happening about a week ago.' },
      { role: 'assistant', content: 'I\'m sorry about that. Could you share the approximate file sizes of the PDFs that aren\'t previewing? And does this happen with all file types or just PDFs?' },
      { role: 'user', content: 'It happens with PDFs over about 5 MB. Smaller ones work fine. Other file types like images and docs preview normally. We share a lot of educational materials as PDFs so this is pretty disruptive.' },
      { role: 'assistant', content: 'Thank you for narrowing that down. It sounds like our PDF preview service may have a file size regression. I\'ll report this to engineering. As a workaround, compressing PDFs before uploading should help in the meantime.' },
    ],
    issue: {
      type: 'bug',
      title: 'PDF preview infinite loading for files over 5 MB',
      description: 'PDF file previews in task attachments show infinite spinner for files larger than approximately 5 MB. Smaller PDFs and other file types preview normally. Regression from approximately one week ago. Likely related to PDF rendering service memory limits.',
      priority: 'medium',
      reach: 3, impact: 2, confidence: 4, effort: 2,
      reachReasoning: 'Affects teams sharing large PDFs. Common in education, legal, and compliance workflows.',
      confidenceReasoning: 'Clear regression with identifiable timeframe. File size threshold (~5 MB) consistently reproduces the issue.',
      effortEstimate: '2-3 days',
      effortReasoning: 'Likely a memory limit adjustment in PDF rendering service. May need streaming or chunked rendering for large files.',
    },
  },

  // ---- 19. Feature Request: Time tracking (Globex / James Wright) ----
  {
    name: 'Built-in time tracking for tasks',
    description: 'Consulting firm needs built-in time tracking for client billing. Wants start/stop timer on task cards, manual time entry, and rollup reports by task, project, and team member.',
    tags: ['feature_request'],
    contactIndex: 3, // James Wright
    productScopeIndex: 1, // Task Management
    messages: [
      { role: 'user', content: 'Does Acme Workspace have built-in time tracking? We\'re currently using a separate tool to track hours spent on tasks and it\'s a pain to keep everything in sync.' },
      { role: 'assistant', content: 'We don\'t have built-in time tracking yet. We do integrate with Toggl and Harvest through our API. What does your ideal time tracking workflow look like?' },
      { role: 'user', content: 'A simple start/stop timer on each task card, with the ability to view total hours per task, per project, and per team member. We need this for client billing - we\'re a consulting firm and need to track billable hours accurately.' },
      { role: 'assistant', content: 'That\'s a clear use case. Start/stop timers with reporting rollups by task, project, and team member would serve consulting firms well. I\'ll add this as a feature request with the billing context.' },
      { role: 'user', content: 'Also, historical time entry would be important. Sometimes people forget to start the timer and need to log hours after the fact.' },
    ],
    issue: {
      type: 'feature_request',
      title: 'Built-in time tracking with start/stop timer and reporting',
      description: 'Consulting firms need built-in time tracking for client billing. Requirements: start/stop timer on task cards, manual time entry for retroactive logging, rollup reports by task/project/team member. Currently requires third-party integrations that are hard to keep in sync.',
      priority: 'low',
      reach: 2, impact: 3, confidence: 3, effort: 5,
      reachReasoning: 'Primarily consulting and agency teams. ~10-15% of customer base would adopt this.',
      confidenceReasoning: 'Clear use case but existing third-party integrations partially address the need.',
      effortEstimate: '4-6 weeks',
      effortReasoning: 'Full feature build: timer UI on task cards, time entry forms, data model, rollup aggregation, and reporting views. Large scope.',
      upvoteCount: 5,
    },
  },

  // ---- 20. Change Request: Board column limits (NovaTech / Samantha Lee) ----
  {
    name: 'Need WIP limits on board columns',
    description: 'Kanban team needs WIP limits on board columns. Wants configurable per-column limits with visual indicators (yellow at limit, red over) and optional hard blocking to enforce discipline.',
    tags: ['change_request'],
    contactIndex: 11, // Samantha Lee
    productScopeIndex: 1, // Task Management
    messages: [
      { role: 'user', content: 'We practice strict Kanban and need WIP (work in progress) limits on our board columns. Right now anyone can drag unlimited tasks into any column, which defeats the purpose of having a Kanban board.' },
      { role: 'assistant', content: 'That\'s a fair point - WIP limits are a core Kanban principle. When you say limits, do you want a hard block (can\'t move tasks if column is full) or a soft warning?' },
      { role: 'user', content: 'Soft warning by default with the option to set hard limits. The column header should change color when the WIP limit is reached. Maybe red for over-limit and yellow for at-limit.' },
      { role: 'assistant', content: 'Great design thinking. A configurable per-column WIP limit with visual indicators (yellow at limit, red over) and optional hard blocking would be a solid implementation. I\'ll file this as a change request.' },
    ],
    issue: {
      type: 'change_request',
      title: 'Add WIP limits to board view columns',
      description: 'Kanban practitioners need work-in-progress limits on board columns. Requirements: configurable per-column limit, visual indicators (yellow at limit, red over), optional hard blocking (prevent drag if over limit). Core feature for teams practicing strict Kanban methodology.',
      priority: 'low',
      reach: 2, impact: 2, confidence: 4, effort: 2,
      reachReasoning: 'Subset of board view users practicing strict Kanban. Niche but passionate user segment.',
      confidenceReasoning: 'Well-defined requirements. Standard feature in dedicated Kanban tools.',
      effortEstimate: '3-5 days',
      effortReasoning: 'Per-column configuration, visual indicators, and optional drag blocking. Moderate UI work with straightforward logic.',
      upvoteCount: 4,
    },
  },

  // ---- 21. Bug: Search not finding attachments (Sterling / Victoria Adams) ----
  {
    name: 'Search doesn\'t find content inside attached documents',
    description: 'Search only indexes task titles, descriptions, and comments - not content inside attached PDFs and Word docs. Critical gap for compliance teams managing regulatory documents and audit reports.',
    tags: ['bug', 'feature_request'],
    contactIndex: 15, // Victoria Adams
    productScopeIndex: 2, // Team Collaboration
    messages: [
      { role: 'user', content: 'When I search for a term that I know exists inside a PDF or Word doc attached to a task, the search returns nothing. It only finds matches in task titles and descriptions.' },
      { role: 'assistant', content: 'You\'re correct - our search currently indexes task content (title, description, comments) but not the content inside file attachments. Is full-text search of attachments something your team relies on heavily?' },
      { role: 'user', content: 'Absolutely. We attach regulatory documents, audit reports, and compliance checklists to tasks. Being able to search across all of them is critical for our compliance team. We expected this to work out of the box given your Enterprise pricing.' },
      { role: 'assistant', content: 'That\'s completely fair feedback. For a financial services company managing compliance documents, full-text search across attachments should be a core capability. I\'ll escalate this - it could be positioned as either a bug fix (search should work across all content) or a feature enhancement.' },
    ],
  },

  // ---- 22. General Feedback: Mobile app experience (Globex / Elena Kowalski) ----
  {
    name: 'Mobile app is getting better but still rough edges',
    description: 'Latest mobile update improved task creation but board view is unusable on phones - columns too narrow. Suggests collapsing board into status-grouped list on mobile instead of replicating desktop layout.',
    tags: ['general_feedback'],
    contactIndex: 2, // Elena Kowalski
    productScopeIndex: 6, // Mobile App
    messages: [
      { role: 'user', content: 'The latest mobile app update is a big improvement - finally we can create tasks from mobile. But the board view on phone is still basically unusable. The columns are too narrow to read task titles.' },
      { role: 'assistant', content: 'Thank you for the feedback on the update! For the board view on phone, would a horizontal scrolling approach work better, or would you prefer a different layout entirely?' },
      { role: 'user', content: 'I think on mobile the board should collapse into a list grouped by column. Trying to replicate the desktop board on a 6-inch screen just doesn\'t work. List view works great on mobile though!' },
      { role: 'assistant', content: 'That\'s a smart suggestion - a list grouped by status column would give the same information in a mobile-friendly layout. I\'ll share this with the mobile team.' },
    ],
  },

  // ---- 23. Loss: Feature gap driving to competitor (Quantum / Chris Nakamura) ----
  {
    name: 'Evaluating alternatives due to missing data features',
    description: 'Data analytics company considering switching due to basic reporting. Needs custom formula fields, cross-project rollup dashboards, and pivot tables. Decision deadline end of Q1.',
    tags: ['losses'],
    contactIndex: 14, // Chris Nakamura
    productScopeIndex: 3, // Reporting & Analytics
    messages: [
      { role: 'user', content: 'We love Acme Workspace but we\'re seriously considering switching to a competitor because your reporting is too basic for our needs. We need custom formula fields and pivot-table style reports.' },
      { role: 'assistant', content: 'I\'d hate to lose you over this. Could you describe the specific reporting capabilities you need? We have some reporting improvements on our roadmap.' },
      { role: 'user', content: 'We need: 1) Custom calculated fields (e.g., cost = hours * rate), 2) Cross-project rollup dashboards, 3) Pivot tables where we can group by any combination of fields. We\'re a data analytics company - we live in spreadsheets and your reporting feels like a toy compared to what we\'re used to.' },
      { role: 'assistant', content: 'Those are power-user features that would benefit many of our data-savvy customers. I\'ll make sure the product team sees this - the threat of churn from analytics-focused companies is very real feedback. Can I connect you with our product team to discuss the roadmap?' },
      { role: 'user', content: 'Sure, but we need to make a decision by end of Q1. If the roadmap doesn\'t show these features in the next 2-3 months, we\'ll need to move.' },
    ],
  },

  // ---- 24. Feature Request: Recurring tasks (Meridian / Dr. Lisa Chang) ----
  {
    name: 'Recurring task templates for compliance workflows',
    description: 'Healthcare team manually creates the same 15-step compliance review every month. Needs template-based recurring task groups with completion-triggered creation and HIPAA audit trail.',
    tags: ['feature_request'],
    contactIndex: 8, // Dr. Lisa Chang
    productScopeIndex: 1, // Task Management
    messages: [
      { role: 'user', content: 'We need recurring tasks for our compliance workflows. Every month we have the same 15-step review process and we\'re manually creating these tasks each time.' },
      { role: 'assistant', content: 'Recurring tasks would definitely save your team time. What recurrence patterns do you need? Daily, weekly, monthly, or more complex schedules?' },
      { role: 'user', content: 'Monthly is the most common, but we also have quarterly and annual compliance reviews. The key thing is that each recurrence creates a full set of subtasks from a template, not just a single task. And the new tasks should only be created when the previous set is completed.' },
      { role: 'assistant', content: 'So you need template-based recurring task groups with a "create next set after completion" trigger. That\'s more sophisticated than simple task recurrence. I\'ll make sure the product team understands the compliance workflow context.' },
      { role: 'user', content: 'Exactly. And an audit trail showing when each recurrence was created and completed would be essential for HIPAA compliance.' },
    ],
    issue: {
      type: 'feature_request',
      title: 'Recurring task templates with completion-triggered creation',
      description: 'Healthcare customers need recurring task groups for compliance workflows. Requirements: task template with subtasks, recurrence on monthly/quarterly/annual schedules, "create next on completion" trigger option, full audit trail of creation and completion dates. Use case: monthly compliance reviews with 15+ step checklists.',
      priority: 'high',
      reach: 4, impact: 4, confidence: 4, effort: 4,
      reachReasoning: 'Compliance teams, ops teams, and anyone with repeating workflows. ~35% of customers have some form of recurring process.',
      confidenceReasoning: '7 upvotes across regulated industries. HIPAA audit trail requirement well-documented.',
      effortEstimate: '3-4 weeks',
      effortReasoning: 'Template engine, recurrence scheduler, completion-triggered creation logic, subtask cloning, and audit trail. Significant feature build.',
      upvoteCount: 7,
    },
  },

  // ---- 25. Change Request: Permissions granularity (Initech / Rachel Torres) ----
  {
    name: 'Project-level permission roles are too broad',
    description: 'Enterprise customer with 420 users needs a Contributor role between Member and Admin. Current 3-tier model too coarse - most users need task management without admin access to settings, members, or billing.',
    tags: ['change_request', 'general_feedback'],
    contactIndex: 6, // Rachel Torres
    productScopeIndex: 5, // User Management
    messages: [
      { role: 'user', content: 'Our current permission model (Admin / Member / Viewer) is too coarse. We need a role that can manage tasks but not change project settings or invite members. Something like a "Contributor" role.' },
      { role: 'assistant', content: 'That\'s a common request from larger organizations. Could you describe the specific permissions you\'d want for this Contributor role?' },
      { role: 'user', content: 'Contributor should be able to: create/edit/delete tasks, add comments, upload files, and view reports. But NOT: change project settings, manage members, delete the project, or access billing. Basically a "power user" without admin capabilities.' },
      { role: 'assistant', content: 'That\'s very clearly defined. A Contributor role between Member and Admin would give teams much better access control. Would you also want the ability to create custom roles with per-permission granularity?' },
      { role: 'user', content: 'Custom roles would be the dream, but even a fixed Contributor role would solve 90% of our problems. We have 420 users and only about 30 should have admin access, but the rest need more than basic member permissions.' },
    ],
    issue: {
      type: 'change_request',
      title: 'Add Contributor role between Member and Admin permissions',
      description: 'Current 3-tier permission model (Admin/Member/Viewer) is too coarse for enterprise teams. Need a Contributor role that can manage tasks and content but not project settings, members, or billing. Affects organizations with 100+ users where only a few should have admin access but most need task management capabilities.',
      priority: 'medium',
      reach: 3, impact: 3, confidence: 5, effort: 3,
      reachReasoning: 'All Enterprise accounts with 100+ users. Also relevant for growing Pro accounts.',
      confidenceReasoning: 'Very clear requirements. Standard RBAC pattern. Multiple Enterprise customers have requested this.',
      effortEstimate: '1-2 weeks',
      effortReasoning: 'New role definition, permission checks across all endpoints, UI for role assignment, and migration for existing users. Well-scoped but touches many surfaces.',
      upvoteCount: 5,
    },
  },
]
