---
title: "Account Setup"
description: "Create your Hissuno account, set up your first project, and invite your team."
---

## Creating Your Account

To get started with Hissuno, visit [hissuno.com](https://hissuno.com) and click **Get Started**. You can sign up using your email address or through a supported SSO provider.

### Email Sign-Up

1. Enter your work email address and choose a password.
2. You will receive a verification email within a few minutes. Click the confirmation link to activate your account.
3. If the email does not arrive, check your spam folder or click **Resend verification** on the login page.

### SSO Sign-Up

If your organization uses Google Workspace or GitHub, you can authenticate directly through those providers. Click the corresponding button on the sign-up page and authorize Hissuno to access your basic profile information.

## Setting Up Your First Project

After verifying your account, Hissuno will prompt you to create your first project. Projects are the top-level container in Hissuno -- each one represents a product or service you want to track customer feedback for.

### Project Details

- **Project name** -- Use your product or service name. This is visible to all team members.
- **Description** -- An optional summary to help teammates understand what this project covers.

You can create additional projects at any time from the sidebar. See [Creating Your First Project](/docs/getting-started/first-project) for a detailed walkthrough.

### Choosing a Plan

Hissuno offers a free tier for small teams exploring the platform. You can upgrade at any time from **/account/billing**, accessible from the account menu in the top-right corner. All plans include the core feedback intelligence features; paid plans unlock higher volume limits and advanced integrations.

## Inviting Team Members

Collaboration is central to Hissuno. You can invite teammates so they can view feedback sessions, manage issues, and contribute to knowledge sources.

### Sending Invitations

1. Navigate to the **Access** page in the project sidebar.
2. Click **Invite Member**.
3. Enter one or more email addresses separated by commas.
4. Select a role for the invited members.
5. Click **Send Invitations**.

Invited users will receive an email with a link to join your project. If they do not already have a Hissuno account, they will be guided through the sign-up flow and automatically added to your project upon completion.

### Team Roles

| Role | Permissions |
|------|-------------|
| **Owner** | Full access. Manages billing, project settings, and can delete projects. |
| **Admin** | Can manage projects, team members, integrations, and all feedback data. |
| **Member** | Can view and interact with projects, feedback sessions, and issues. Cannot manage billing or project settings. |

### Managing Existing Members

From the **Access** page you can:

- Change a member's role using the dropdown next to their name.
- Remove a member by clicking the remove icon. Removing a member does not delete any data they created.
- Resend a pending invitation if it has expired.

### API Keys

The **Access** page also provides management for API keys. You can generate and revoke API keys used for programmatic access to your project, such as widget authentication and external integrations.

## Profile Settings

Each team member can configure their own profile from **/account/settings**, accessible from the account menu in the top-right corner:

- **Display name** -- How your name appears in activity feeds and comments.
- **Email notifications** -- Toggle digest emails for new issues, feedback summaries, and weekly reports.
- **Timezone** -- Used for scheduling and displaying timestamps throughout the dashboard.

## Security Recommendations

- Use a strong, unique password or authenticate through SSO.
- Periodically review your team member list on the **Access** page and remove users who no longer need access.
- Hissuno enforces row-level security on all data. Each user can only access projects they belong to.

## Next Steps

Once your account and project are ready, proceed to [Creating Your First Project](/docs/getting-started/first-project) to start collecting and analyzing customer feedback.
