export interface DemoKnowledgeSource {
  name: string
  description: string
  content: string
  productScopeIndex: number | null // index into DEMO_PRODUCT_SCOPES, null = no link
  companyIndex?: number | null // index into DEMO_COMPANIES, null = no link
}

export const DEMO_KNOWLEDGE_SOURCES: DemoKnowledgeSource[] = [
  {
    name: 'Getting Started Guide',
    description: 'Step-by-step guide for new users covering workspace setup, team invitations, and first project creation.',
    productScopeIndex: 0, // General
    content: `# Getting Started with Acme Workspace

Welcome to Acme Workspace! This guide will help you set up your workspace and get your team collaborating in minutes.

## Creating Your Workspace

1. Sign up at workspace.acme.com with your work email
2. Choose a workspace name (this will be your subdomain: yourteam.workspace.acme.com)
3. Select your plan (Starter, Pro, or Enterprise)

## Inviting Team Members

Navigate to Settings > Team Members to invite your colleagues:
- **Email invites**: Enter email addresses separated by commas
- **Link invites**: Generate a shareable join link with an expiration date
- **SSO**: Enterprise plans can configure SAML SSO for automatic provisioning

## Setting Up Your First Project

Projects are the primary way to organize work in Acme Workspace:
1. Click "New Project" from the sidebar
2. Choose a template (Kanban, Sprint Board, Timeline, or Blank)
3. Add team members to the project
4. Create your first tasks

## Key Concepts

- **Workspaces**: Your top-level organization. Each workspace has its own billing, members, and settings.
- **Projects**: Collections of tasks organized around a goal or team. Projects can be public or private.
- **Tasks**: Individual work items with assignees, due dates, priorities, and custom fields.
- **Views**: Different ways to visualize your tasks (Board, List, Timeline, Calendar).

## Quick Tips

- Use \`Cmd+K\` (Mac) or \`Ctrl+K\` (Windows) to quickly search and navigate
- Mention teammates with \`@name\` in comments to notify them
- Use task templates for repeating workflows
- Set up automations under Project Settings > Automations to reduce manual work

## Need Help?

- Visit our Help Center at help.acme-workspace.com
- Join our community forum at community.acme-workspace.com
- Contact support via the in-app chat widget`,
  },
  {
    name: 'API Reference - Authentication',
    description: 'Technical reference for API authentication including token types, OAuth 2.0 flow, rate limits, and error codes.',
    productScopeIndex: 4, // Integrations & API
    content: `# Acme Workspace API - Authentication

The Acme Workspace API uses token-based authentication. All API requests must include a valid authentication header.

## API Keys

Generate API keys from Settings > Integrations > API Keys.

### Key Types
- **Personal tokens**: Scoped to your user account, inherit your permissions
- **Service tokens**: Scoped to a workspace, ideal for CI/CD and automation
- **OAuth tokens**: For third-party app integrations

### Using API Keys

Include the key in the Authorization header:

\`\`\`
Authorization: Bearer acme_sk_live_xxxxxxxxxxxx
\`\`\`

### Key Permissions

API keys can be scoped to specific permissions:
- \`read:tasks\` - Read tasks and projects
- \`write:tasks\` - Create and update tasks
- \`admin:workspace\` - Manage workspace settings
- \`read:reports\` - Access reporting data

## OAuth 2.0

For third-party integrations, we support the OAuth 2.0 authorization code flow.

### Endpoints
- Authorization: \`https://auth.acme-workspace.com/oauth/authorize\`
- Token: \`https://api.acme-workspace.com/oauth/token\`
- Revoke: \`https://api.acme-workspace.com/oauth/revoke\`

## Rate Limits

| Plan | Requests/minute | Burst |
|------|-----------------|-------|
| Starter | 60 | 100 |
| Pro | 300 | 500 |
| Enterprise | 1000 | 2000 |

Rate limit headers are included in every response:
- \`X-RateLimit-Limit\`: Your plan's limit
- \`X-RateLimit-Remaining\`: Requests remaining in the window
- \`X-RateLimit-Reset\`: Unix timestamp when the window resets

When rate limited, the API returns a \`429 Too Many Requests\` response with a \`Retry-After\` header.

## Error Codes

| Code | Meaning |
|------|---------|
| 401 | Invalid or expired token |
| 403 | Token lacks required permission scope |
| 429 | Rate limit exceeded |`,
  },
  {
    name: 'FAQ - Billing & Plans',
    description: 'Frequently asked questions about pricing tiers, billing cycles, payment methods, and plan changes.',
    productScopeIndex: null,
    content: `# Billing & Plans FAQ

## Plan Comparison

### Starter Plan ($12/user/month)
- Up to 10 projects
- Basic task management
- 5 GB file storage
- Email support
- Community forum access

### Pro Plan ($29/user/month)
- Unlimited projects
- Advanced workflows and automations
- Custom fields and views
- 50 GB file storage
- Priority email and chat support
- Timeline and workload views
- Guest access (up to 5 guests)

### Enterprise Plan (Custom pricing)
- Everything in Pro
- SAML SSO and SCIM provisioning
- Advanced security and compliance (SOC 2, HIPAA)
- Unlimited file storage
- Dedicated customer success manager
- Custom integrations and API priority
- 99.99% uptime SLA
- Audit logs and data residency options

## Frequently Asked Questions

**Can I change plans at any time?**
Yes. Upgrades take effect immediately and are prorated. Downgrades take effect at the end of your current billing cycle.

**Do you offer annual billing?**
Yes, annual billing saves 20% compared to monthly. Contact sales for Enterprise annual agreements.

**What payment methods do you accept?**
We accept Visa, Mastercard, American Express, and bank transfers (Enterprise only). All payments are processed securely through Stripe.

**Can I get a refund?**
We offer a 30-day money-back guarantee for new subscriptions. After that, we do not offer refunds for partial billing periods.

**How does per-seat pricing work?**
You're billed for the number of active members in your workspace. Deactivated members don't count toward your seat limit. Guest users on the Pro plan are free up to 5, then $5/guest/month.

**Do you offer discounts for nonprofits or education?**
Yes! We offer 50% off for verified nonprofits and educational institutions. Contact sales@acme-workspace.com with your organization details.`,
  },
  {
    name: 'Troubleshooting - Common Issues',
    description: 'Solutions for common problems including login failures, sync issues, notification gaps, and performance troubleshooting.',
    productScopeIndex: null,
    content: `# Troubleshooting Common Issues

## Login Problems

### "Invalid credentials" error
- Verify you're using the correct email associated with your Acme Workspace account
- Check if Caps Lock is on
- Try resetting your password via the "Forgot Password" link
- If using SSO, ensure you're clicking "Sign in with SSO" and entering your workspace URL

### Two-factor authentication issues
- If you've lost your authenticator app, use one of your backup codes
- Contact your workspace admin to reset 2FA on your account
- Backup codes are generated when you first enable 2FA

## Sync Issues

### Tasks not updating in real-time
- Check your internet connection
- Try refreshing the page (Cmd+R / Ctrl+R)
- Clear your browser cache and cookies for acme-workspace.com
- Disable browser extensions that might interfere (ad blockers, privacy extensions)
- If using the desktop app, try signing out and back in

### Mobile app not syncing
- Ensure you have the latest version from the App Store / Google Play
- Check that background app refresh is enabled for Acme Workspace
- Try force-closing and reopening the app
- Verify your device has a stable internet connection

## Notification Issues

### Not receiving email notifications
- Check your spam/junk folder
- Verify your notification preferences at Settings > Notifications
- Add notifications@acme-workspace.com to your contacts
- Check if your IT department is blocking our emails

### In-app notifications not appearing
- Ensure notifications are enabled in your browser (Settings > Site permissions)
- Check your project notification settings (some projects may have notifications muted)

## Performance

### Slow page loads
- Close unused browser tabs
- Clear your browser cache
- Try using an incognito/private window
- Check if the issue persists on a different browser
- Large projects (5000+ tasks) may take longer to load. Try using filters to reduce the displayed tasks.

### File upload failures
- Maximum file size: 100 MB (Starter), 500 MB (Pro/Enterprise)
- Supported formats: Most common file types are supported
- If uploads consistently fail, try a different browser or disable any VPN`,
  },
  {
    name: 'Release Notes - v3.2',
    description: 'Changelog for version 3.2 including timeline improvements, workload management, custom automations, and bug fixes.',
    productScopeIndex: null,
    content: `# Release Notes - Acme Workspace v3.2

Released: February 2026

## New Features

### Timeline View Improvements
- Drag-and-drop task rescheduling on the timeline
- Dependency arrows now show critical path highlighting
- Zoom levels: Day, Week, Month, Quarter
- Export timeline as PDF or PNG

### Workload Management
- New workload view showing team capacity across projects
- Set capacity limits per team member (hours/week)
- Visual indicators for overallocated team members
- Automatic rebalancing suggestions

### Custom Automations
- New automation builder with visual workflow editor
- 15+ trigger types (task created, status changed, due date approaching, etc.)
- Conditional logic with AND/OR operators
- Cross-project automations (Enterprise only)

## Improvements

- Task comments now support rich text formatting with markdown
- Board view cards can display up to 5 custom fields
- Search results now include comments and attachments
- Improved keyboard navigation across all views
- API response times improved by 40% for list endpoints
- Mobile app: Added offline mode for viewing tasks

## Bug Fixes

- Fixed: Tasks duplicated when moving between projects quickly
- Fixed: Calendar view showing events on wrong day for UTC-offset timezones
- Fixed: File preview not loading for PDFs over 10 MB
- Fixed: @mentions in comments not sending notifications to guests
- Fixed: Custom field dropdown options not saving when adding more than 20 values

## Known Issues

- Timeline view may flicker on Firefox 121+ when many dependencies are displayed
- Custom automations with more than 10 steps may time out on Starter plans
- Mobile app push notifications may be delayed up to 5 minutes on Android 14

## Deprecations

- Legacy webhook format (v1) will be removed in v3.4. Please migrate to v2 format.
- The \`/api/v1/tasks/list\` endpoint is deprecated in favor of \`/api/v2/tasks\`. It will be removed in v4.0.`,
  },

  // ---- Customer-specific knowledge sources ----

  {
    name: 'Initech Systems - Enterprise Deployment Guide',
    description: 'Custom deployment documentation for Initech Systems covering their SSO configuration, project templates, and API integration setup.',
    productScopeIndex: 5, // User Management
    companyIndex: 2, // Initech Systems
    content: `# Initech Systems - Enterprise Deployment Guide

## Account Overview
- **Plan**: Enterprise (420 seats)
- **SSO Provider**: Okta (SAML 2.0)
- **Workspace URL**: initech.workspace.acme.com
- **Primary Contact**: David Park (CTO)

## SSO Configuration

Initech uses Okta with SAML 2.0 for single sign-on:
- **Entity ID**: https://initech.workspace.acme.com/saml/metadata
- **ACS URL**: https://initech.workspace.acme.com/saml/acs
- **Session duration**: 12 hours (configured in Okta)
- **Auto-provisioning**: Enabled via SCIM

## Custom Project Templates

Initech has 3 custom templates configured:
1. **Sprint Board** - 2-week sprints with story points, sprint goals, and retrospective tasks
2. **Release Planning** - Quarterly release cycles with milestone gates and QA checkpoints
3. **Incident Response** - P0/P1 incident tracking with SLA timers and post-mortem tasks

## API Integration

Initech syncs task data with their internal JIRA instance:
- **Sync frequency**: Every 15 minutes via service token
- **Endpoints used**: /api/v2/tasks, /api/v2/tasks/batch, /api/v2/webhooks
- **Rate limit**: Enterprise tier (1000 req/min)

## Known Issues & Workarounds

- Task dependency cascade does not work in timeline view (tracked as high-priority bug)
- Custom fields "Story Points" and "Sprint" not visible on board cards (feature request submitted)`,
  },
  {
    name: 'Sterling Financial - Compliance Configuration',
    description: 'Compliance and security setup for Sterling Financial including audit logging, data residency, and regulatory reporting requirements.',
    productScopeIndex: 5, // User Management
    companyIndex: 9, // Sterling Financial
    content: `# Sterling Financial - Compliance Configuration

## Account Overview
- **Plan**: Enterprise (550 seats)
- **Industry**: Financial Services (OCC regulated)
- **SSO Provider**: Azure AD (SAML 2.0)
- **Primary Contact**: Victoria Adams (SVP Digital Products)
- **Compliance Contact**: Robert Kim (Principal Architect)

## Security & Compliance Setup

### Data Residency
- **Region**: US-East (Virginia)
- **Backup**: US-West (Oregon)
- **Data retention**: 7 years (regulatory requirement)

### Audit Logging
- All user actions logged with full audit trail
- Audit logs exported monthly to Sterling's SIEM (Splunk)
- Export format: JSON via /api/v2/audit-logs endpoint

### Access Controls
- SSO mandatory for all users (no password-based auth)
- Session duration: 8 hours (Azure AD configured)
- IP allowlist: 203.0.113.0/24, 198.51.100.0/24
- MFA required for all admin roles

## Regulatory Requirements

### OCC Quarterly Reviews
Sterling presents project timelines to OCC regulators quarterly:
- Need clean PDF export of Gantt charts (feature request pending)
- Current workaround: browser print-to-PDF with sidebar collapsed
- Reports must include: task names, dates, dependencies, and milestone markers

### Document Management
- All regulatory documents attached to compliance tasks
- Full-text search of attachments needed (reported as missing feature)
- PDF previews required for documents up to 50 MB

## Integration Points
- Azure AD for SSO and user provisioning
- Splunk for audit log ingestion
- ServiceNow for IT ticket cross-referencing`,
  },
  {
    name: 'Meridian Health - HIPAA Workflow Setup',
    description: 'HIPAA-compliant configuration for Meridian Health covering notification urgency, compliance review workflows, and mobile access policies.',
    productScopeIndex: 0, // General
    companyIndex: 4, // Meridian Health
    content: `# Meridian Health - HIPAA Workflow Setup

## Account Overview
- **Plan**: Pro (210 seats)
- **Industry**: Healthcare (HIPAA regulated)
- **Primary Contact**: Dr. Lisa Chang (Chief Product Officer)
- **Technical Contact**: Kevin O'Brien (Lead Developer)

## HIPAA Considerations

### Notification Urgency
- Healthcare workflows require real-time notifications for task assignments
- Android push notification delays (10-30 min) are a critical issue for Meridian
- Workaround: iOS devices for time-sensitive assignments until Android batching fix ships

### Notification Preferences
Dr. Chang's team needs granular notification controls:
- Real-time: @mentions, own task status changes, deadline warnings
- Daily digest: General project updates, comments on watched tasks
- Silent: All other activity

### Compliance Review Workflows
Monthly HIPAA compliance reviews follow a 15-step checklist:
1. Review access logs for unauthorized attempts
2. Verify all PHI-containing tasks are in restricted projects
3. Confirm user provisioning/deprovisioning is current
4. Audit file attachments for PHI classification
5. Review and approve data retention policies
... (10 additional steps)

**Need**: Recurring task templates with completion-triggered creation (feature request submitted)

## Mobile Access Policy
- Mobile app approved for non-PHI task management only
- PHI-containing projects restricted to desktop web access
- Background app refresh must remain enabled for notification delivery`,
  },
]
