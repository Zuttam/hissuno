/**
 * Demo Data Service
 *
 * Creates a rich set of demo data across all entities for demo projects.
 * Used during onboarding when a user chooses the "Demo Project" option.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { createManualSession } from '@/lib/supabase/sessions'
import { createIssueAdmin } from '@/lib/issues/issues-service'
import { insertCompany } from '@/lib/supabase/companies'
import { insertContact } from '@/lib/supabase/contacts'
import { createAdminClient } from '@/lib/supabase/server'
import type { SessionTag } from '@/types/session'

// ============================================================================
// Demo Sessions (reuse from existing demo-sessions route)
// ============================================================================

interface DemoSession {
  name: string
  tags: SessionTag[]
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
  issue?: {
    type: 'bug' | 'feature_request' | 'change_request'
    title: string
    description: string
    priority: 'low' | 'medium' | 'high'
    /** If set, a short product spec will be added to the issue */
    productSpec?: string
  }
}

const DEMO_SESSIONS: DemoSession[] = [
  {
    name: 'Login page crashes on mobile Safari',
    tags: ['bug'],
    messages: [
      { role: 'user', content: 'Hi, I\'m trying to log in on my iPhone but the page keeps crashing in Safari. It works fine on desktop Chrome.' },
      { role: 'assistant', content: 'I\'m sorry to hear you\'re experiencing issues on mobile Safari. Could you tell me which iPhone model and iOS version you\'re using?' },
      { role: 'user', content: 'iPhone 14 Pro, iOS 17.2. The page loads but when I tap the password field it just freezes and then Safari reloads the page.' },
      { role: 'assistant', content: 'Thank you for those details. This sounds like it could be related to our autofill handling on iOS. I\'ve flagged this for our engineering team to investigate. In the meantime, could you try using the "Sign in with Google" option as a workaround?' },
      { role: 'user', content: 'That works, thanks! But please fix the regular login — my team members don\'t all have Google accounts.' },
    ],
    issue: {
      type: 'bug',
      title: 'Login page crashes on mobile Safari (iOS 17+)',
      description: 'The login page freezes and reloads when tapping the password field on iOS Safari. Likely caused by autofill handling interfering with the input focus event. Affects iPhone 14 Pro on iOS 17.2, possibly other devices. Workaround: Sign in with Google.',
      priority: 'high',
      productSpec: '## Fix: Mobile Safari Login Crash\n\n### Problem\nPassword field tap causes page freeze/reload on iOS Safari 17+.\n\n### Root Cause\nAutofill handler conflicts with iOS keyboard focus events.\n\n### Solution\n1. Debounce autofill detection on iOS\n2. Use `inputmode="text"` with manual password toggle\n3. Add iOS-specific focus event handling\n\n### Testing\n- iPhone 14 Pro, iOS 17.2\n- iPhone 13, iOS 17.1\n- iPad Pro, iPadOS 17',
    },
  },
  {
    name: 'Feature request: Bulk export to CSV',
    tags: ['feature_request'],
    messages: [
      { role: 'user', content: 'Is there a way to export all our session data to CSV? We need to share reports with stakeholders who don\'t have access to the dashboard.' },
      { role: 'assistant', content: 'Currently we support exporting individual sessions. Are you looking to export all sessions at once, or a filtered subset?' },
      { role: 'user', content: 'Ideally a filtered subset — like all sessions from the last month tagged as "bug". We do quarterly reviews and need to pull data for different time ranges and categories.' },
      { role: 'assistant', content: 'That makes a lot of sense. I\'ll pass this along as a feature request. Being able to bulk export filtered sessions with date ranges and tag filters would be very useful for reporting workflows.' },
      { role: 'user', content: 'Exactly. Even a simple CSV with session name, date, tags, and summary would be incredibly helpful. Thanks!' },
    ],
    issue: {
      type: 'feature_request',
      title: 'Bulk CSV export with date range and tag filters',
      description: 'Users need the ability to export filtered subsets of sessions to CSV for quarterly reviews. Should support filtering by date range and tags, and include columns for session name, date, tags, and summary. Currently only individual session export is available.',
      priority: 'medium',
      productSpec: '## Feature: Bulk CSV Export\n\n### Overview\nAllow users to export filtered session data to CSV for reporting.\n\n### Requirements\n- Filter by date range, tags, and status\n- Columns: session name, date, tags, summary, user, status\n- Max 10,000 rows per export\n- Background job for large exports with email notification\n\n### UX\n1. Add "Export" button to sessions list toolbar\n2. Show filter summary before export\n3. Download starts automatically\n\n### API\n`POST /api/projects/:id/exports` with filter params, returns CSV stream.',
    },
  },
  {
    name: 'API rate limits too restrictive for our use case',
    tags: ['change_request'],
    messages: [
      { role: 'user', content: 'We\'re hitting the API rate limit when syncing customer data from our CRM. We process about 500 records per minute during peak hours.' },
      { role: 'assistant', content: 'I understand the rate limit is impacting your workflow. Could you share more about your integration setup? Specifically, are you using batch endpoints or individual requests?' },
      { role: 'user', content: 'Individual requests right now. We didn\'t see a batch endpoint in the docs. Is there one?' },
      { role: 'assistant', content: 'We do have a batch endpoint at /api/v1/sessions/batch that accepts up to 100 records per request. That should significantly reduce the number of API calls. I\'ll also flag your use case to our team — 500 records/minute is a valid enterprise workflow.' },
      { role: 'user', content: 'Oh great, the batch endpoint helps. But it would still be nice to have higher limits for paid plans. We\'re on the Pro plan.' },
    ],
  },
  {
    name: 'Love the new dashboard redesign!',
    tags: ['general_feedback', 'wins'],
    messages: [
      { role: 'user', content: 'Just wanted to say the new dashboard is fantastic! The session timeline view makes it so much easier to spot trends. My PM team loves it.' },
      { role: 'assistant', content: 'Thank you so much for the kind words! We put a lot of work into the timeline view. Is there anything specific about it that your team finds most useful?' },
      { role: 'user', content: 'The ability to see conversation sentiment over time is great. We can actually correlate it with product releases and see if changes improved or worsened the customer experience. Really powerful stuff.' },
    ],
  },
  {
    name: 'Webhook delivery failing intermittently',
    tags: ['bug'],
    messages: [
      { role: 'user', content: 'Our webhook endpoint has been receiving about 70% of events since yesterday. We\'re not seeing any errors on our end — the missing events just never arrive.' },
      { role: 'assistant', content: 'I can look into this for you. Could you share your webhook endpoint URL (or the last few characters) and the approximate timeframe when you noticed the failures?' },
      { role: 'user', content: 'The endpoint ends in /webhooks/hissuno. Started noticing around 3pm UTC yesterday. Our server logs show no incoming requests for the missing events.' },
      { role: 'assistant', content: 'I\'ve checked our delivery logs and it looks like those events are failing with a timeout. Your endpoint might be taking longer than our 10-second timeout to respond during peak hours. Could you check if there\'s any processing happening synchronously in your webhook handler?' },
      { role: 'user', content: 'Ah, yes — we were doing database writes synchronously. We\'ll queue those instead. But 10 seconds seems short, could you increase the timeout or add retry logic?' },
      { role: 'assistant', content: 'We do retry failed deliveries up to 3 times with exponential backoff, but only for 5xx responses — timeouts currently aren\'t retried. I\'ll flag this as a bug since timeouts should definitely trigger retries too.' },
    ],
    issue: {
      type: 'bug',
      title: 'Webhook timeouts not retried (only 5xx responses trigger retry)',
      description: 'Webhook delivery retries only trigger for 5xx HTTP responses. Timeouts (10s limit) silently fail without retries, causing ~30% event loss for endpoints with slower processing. Should treat timeouts as retriable failures with the same exponential backoff logic.',
      priority: 'high',
    },
  },
]

// ============================================================================
// Demo Companies
// ============================================================================

interface DemoCompany {
  name: string
  domain: string
  stage: string
  industry: string
  arr: number
  planTier: string
  employeeCount: number
  country: string
  healthScore: number
}

const DEMO_COMPANIES: DemoCompany[] = [
  {
    name: 'Acme Corp',
    domain: 'acme.example.com',
    stage: 'active',
    industry: 'SaaS',
    arr: 120000,
    planTier: 'Pro',
    employeeCount: 85,
    country: 'US',
    healthScore: 82,
  },
  {
    name: 'Globex Inc',
    domain: 'globex.example.com',
    stage: 'onboarding',
    industry: 'Fintech',
    arr: 45000,
    planTier: 'Starter',
    employeeCount: 32,
    country: 'UK',
    healthScore: 65,
  },
  {
    name: 'Initech Systems',
    domain: 'initech.example.com',
    stage: 'expansion',
    industry: 'Enterprise Software',
    arr: 280000,
    planTier: 'Enterprise',
    employeeCount: 420,
    country: 'US',
    healthScore: 91,
  },
  {
    name: 'Umbrella Labs',
    domain: 'umbrellalabs.example.com',
    stage: 'churned',
    industry: 'Biotech',
    arr: 0,
    planTier: 'Starter',
    employeeCount: 15,
    country: 'DE',
    healthScore: 12,
  },
]

// ============================================================================
// Demo Contacts (linked to companies by index)
// ============================================================================

interface DemoContact {
  name: string
  email: string
  companyIndex: number // index into DEMO_COMPANIES
  role: string
  title: string
  isChampion: boolean
}

const DEMO_CONTACTS: DemoContact[] = [
  { name: 'Sarah Chen', email: 'sarah@acme.example.com', companyIndex: 0, role: 'Engineering', title: 'VP of Engineering', isChampion: true },
  { name: 'Marcus Johnson', email: 'marcus@acme.example.com', companyIndex: 0, role: 'Product', title: 'Senior PM', isChampion: false },
  { name: 'Elena Kowalski', email: 'elena@globex.example.com', companyIndex: 1, role: 'Engineering', title: 'Tech Lead', isChampion: true },
  { name: 'David Park', email: 'david@initech.example.com', companyIndex: 2, role: 'Engineering', title: 'CTO', isChampion: true },
  { name: 'Priya Sharma', email: 'priya@initech.example.com', companyIndex: 2, role: 'Support', title: 'Head of Support', isChampion: false },
  { name: 'Tom Mueller', email: 'tom@umbrellalabs.example.com', companyIndex: 3, role: 'Product', title: 'Product Manager', isChampion: false },
]

// ============================================================================
// Main Service Function
// ============================================================================

export async function createDemoProjectData({
  projectId,
  supabase,
}: {
  projectId: string
  supabase: SupabaseClient
}): Promise<{
  sessionsCreated: number
  issuesCreated: number
  companiesCreated: number
  contactsCreated: number
}> {
  const adminSupabase = createAdminClient()

  let sessionsCreated = 0
  let issuesCreated = 0
  let companiesCreated = 0
  let contactsCreated = 0

  // 1. Create sessions and issues
  for (const demo of DEMO_SESSIONS) {
    try {
      const session = await createManualSession({
        project_id: projectId,
        name: demo.name,
        tags: demo.tags,
        messages: demo.messages,
      })

      if (!session) continue
      sessionsCreated++

      // If this session has a linked issue, close the session and create the issue
      if (demo.issue) {
        // Mark session as closed and PM reviewed
        await adminSupabase
          .from('sessions')
          .update({
            status: 'closed',
            pm_reviewed_at: new Date().toISOString(),
          })
          .eq('id', session.id)
          .eq('project_id', projectId)

        // Create the linked issue
        try {
          const { issue } = await createIssueAdmin({
            projectId,
            sessionId: session.id,
            type: demo.issue.type,
            title: demo.issue.title,
            description: demo.issue.description,
            priority: demo.issue.priority,
          })
          issuesCreated++

          // Add product spec if defined
          if (demo.issue.productSpec) {
            await adminSupabase
              .from('issues')
              .update({
                product_spec: demo.issue.productSpec,
                product_spec_generated_at: new Date().toISOString(),
              })
              .eq('id', issue.id)
              .eq('project_id', projectId)
          }
        } catch (err) {
          console.error('[demo-data-service] failed to create issue for:', demo.name, err)
        }
      }
    } catch (err) {
      console.error('[demo-data-service] failed to create demo session:', demo.name, err)
    }
  }

  // 2. Create companies
  const companyIds: string[] = []
  for (const company of DEMO_COMPANIES) {
    try {
      const created = await insertCompany(supabase, {
        projectId,
        name: company.name,
        domain: company.domain,
        stage: company.stage,
        industry: company.industry,
        arr: company.arr,
        planTier: company.planTier,
        employeeCount: company.employeeCount,
        country: company.country,
        healthScore: company.healthScore,
      })
      companyIds.push(created.id)
      companiesCreated++
    } catch (err) {
      console.error('[demo-data-service] failed to create company:', company.name, err)
      companyIds.push('') // placeholder to maintain index alignment
    }
  }

  // 3. Create contacts (linked to companies)
  for (const contact of DEMO_CONTACTS) {
    try {
      const companyId = companyIds[contact.companyIndex] || null
      await insertContact(supabase, {
        projectId,
        name: contact.name,
        email: contact.email,
        companyId,
        role: contact.role,
        title: contact.title,
        isChampion: contact.isChampion,
      })
      contactsCreated++
    } catch (err) {
      console.error('[demo-data-service] failed to create contact:', contact.name, err)
    }
  }

  console.log(
    '[demo-data-service] created demo data for project:',
    projectId,
    { sessionsCreated, issuesCreated, companiesCreated, contactsCreated }
  )

  return { sessionsCreated, issuesCreated, companiesCreated, contactsCreated }
}
