---
title: "Companies and Contacts"
description: "Manage your customer companies and contacts, and link them to feedback for customer-aware issue prioritization."
---

## Overview

Hissuno includes a built-in CRM for managing the companies and contacts that interact with your product. Customer data flows directly into issue prioritization -- every feedback session linked to a contact carries that contact's company ARR, lifecycle stage, and relationship context into the impact scoring algorithm. This means your backlog is automatically weighted by the customers who matter most to your business.

## Companies

Companies represent the organizations that use your product. Each company belongs to a single project in Hissuno.

### Company Fields

| Field | Description |
|-------|-------------|
| **Name** | The company's display name. |
| **Domain** | The company's email domain (for example, `acme.com`). Used for automatic contact-to-company matching. |
| **ARR** | Annual recurring revenue. Directly feeds into issue impact scoring. |
| **Stage** | Lifecycle stage: prospect, onboarding, active, expansion, or churned. |
| **Industry** | The company's industry vertical. |
| **Plan Tier** | The pricing plan the company is on. |
| **Employee Count** | Size of the organization. |
| **Renewal Date** | When the company's contract is up for renewal. |
| **Health Score** | A 0-100 score representing account health. |
| **Country** | The company's primary location. |
| **Notes** | Free-text notes for your team. |

### Creating a Company

1. Navigate to **Customers** in the sidebar and select the **Companies** tab.
2. Click **Add Company**.
3. Fill in the company name and domain at minimum.
4. Set the lifecycle stage and ARR if known.
5. Click **Save**.

You can also import companies in bulk via CSV. See the import section below.

### Editing a Company

Open a company from the list to view its detail sidebar. All fields support inline editing -- hover over any field to reveal the edit icon, click it, make your changes, and confirm. Changes are saved immediately.

## Contacts

Contacts are the individual people at your customer companies who provide feedback, report issues, or interact with the Hissuno Agent.

### Contact Fields

| Field | Description |
|-------|-------------|
| **Name** | The contact's full name. |
| **Email** | Their email address. Must be unique within a project. |
| **Company** | The company this contact belongs to. |
| **Role** | Their functional role (for example, "Engineering Manager"). |
| **Title** | Their job title. |
| **Phone** | Phone number. |
| **Champion** | Boolean flag indicating whether this contact is a product champion. |
| **Last Contacted** | Timestamp of their most recent feedback session. Updated automatically. |
| **Notes** | Free-text notes for your team. |

### Creating a Contact

1. Navigate to **Customers** in the sidebar and select the **Contacts** tab.
2. Click **Add Contact**.
3. Enter the contact's name and email.
4. Optionally select their company from the dropdown.
5. Click **Save**.

### Editing a Contact

Contact details are edited inline from the contact sidebar, following the same hover-to-reveal pattern as companies. The company field uses a searchable dropdown so you can reassign contacts between companies.

## Company-Contact Relationships

Each contact can belong to one company. The relationship is established through the company field on the contact record.

### Automatic Resolution

When a feedback session closes, Hissuno automatically attempts to resolve the customer's identity. The Contact Resolution service:

1. Extracts the email address from the session's user metadata (checking common key variants like `email`, `Email`, `emailAddress`).
2. Searches for an existing contact with that email in the project.
3. If found, links the session to the contact and updates their `last_contacted_at` timestamp.
4. If not found, creates a new contact record automatically. The name is derived from metadata or inferred from the email address.
5. Resolves the company by matching the email domain against existing company domains. Generic email providers (Gmail, Yahoo, Outlook, and others) are excluded from domain matching.

This means your CRM grows organically as customers interact with your product. You do not need to pre-populate every contact before collecting feedback.

### Manual Linking

You can manually link a feedback session to a contact from the session detail view. Click the customer field and search for the contact you want to assign. This is useful when the session does not include email metadata or when you want to override the automatic resolution.

## Linking Feedback to Customers

The connection between feedback and customers is what powers Hissuno's customer-aware prioritization. Here is how data flows:

1. A customer sends feedback through the widget, Slack, Intercom, Gong, or the API.
2. The session closes and the Session Review workflow runs.
3. Contact resolution links the session to a contact (and by extension, their company).
4. The PM Agent creates or upvotes an issue linked to the session.
5. The Issue Analysis workflow computes impact scores using the linked customer's ARR and company stage.
6. Priority is calculated with customer impact as the dominant factor (60% of the impact score).

### Viewing a Customer's Feedback History

From any company or contact detail view, you can see all feedback sessions associated with that customer. This gives you a complete picture of what a particular account has been asking for, reporting, or struggling with.

## CSV Import

For teams with existing customer data, Hissuno supports bulk import via CSV files.

### Importing Companies and Contacts

1. Navigate to **Customers** in the sidebar and select the **Companies** or **Contacts** tab.
2. Click **Import CSV**.
3. Upload your CSV file.
4. Map CSV columns to Hissuno fields using the column mapping interface. Sample values from your CSV are displayed to help you verify the mapping.
5. Click **Import**.

The import process creates new records and updates existing ones (matched by email for contacts or domain for companies). A summary is displayed after import showing the number of records created, updated, and any rows that encountered errors.

## Analytics

The Customers overview strip displays key metrics across your customer base:

- **Total Companies** -- Number of company records in the project.
- **Total Contacts** -- Number of contact records.
- **Champions** -- Number of contacts flagged as champions.
- **Total ARR** -- Sum of ARR across all companies.
- **Average ARR** -- Mean ARR per company.
- **By Stage** -- Breakdown of companies across lifecycle stages with percentages.
