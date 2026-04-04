---
title: "Gong Integration"
description: "Connect Gong to Hissuno to analyze customer call transcripts and extract product feedback from sales and support conversations."
---

## Overview

The Gong integration brings customer call transcripts into Hissuno for automated feedback analysis. Sales calls, support calls, and customer success check-ins often contain valuable product feedback that is difficult to capture manually. Hissuno processes these transcripts to identify feature requests, bug reports, and recurring pain points.

> **Early Access:** The Gong integration is currently in Early Access behind a feature flag. Request access from the Integrations page.

## Connecting Gong

### Prerequisites

- A Gong account with admin or technical admin permissions
- Gong API credentials (access key and access key secret)
- An active Hissuno project

### Setup Steps

1. Navigate to **Integrations** in the sidebar and click **Configure** on the Gong card
2. Enter your Gong **base URL** (e.g., `https://your-org.api.gong.io`)
3. Enter your Gong **access key** and **access key secret**
4. Select a sync frequency from the dropdown: manual, every 1 hour, every 6 hours, or every 24 hours
5. Optionally set a **From Date** and **To Date** to filter which calls are imported
6. Click **Save** to activate the integration

### API Credentials

You can generate API credentials from your Gong admin settings under **Company Settings > API**. Hissuno does not use OAuth for Gong -- you provide the access key and secret directly in the configuration dialog.

Hissuno has read-only access and never modifies any data in Gong.

## Which Calls Are Imported

### Default Behavior

By default, Hissuno imports calls that have a completed transcript (Gong has finished processing) and fall within your configured date range.

### Filtering Options

You can filter which calls are imported using the **From Date** and **To Date** fields in the Gong configuration dialog. These date filters control the time window for both the initial import and ongoing syncs. Adjust the date range to focus on the most relevant calls for your analysis.

## Transcript Processing

### How Transcripts Are Analyzed

When a call transcript arrives in Hissuno, it goes through a multi-step processing pipeline:

1. **Segmentation** -- The transcript is split into meaningful conversation segments based on topic changes
2. **Speaker identification** -- Customer vs. internal team member segments are separated
3. **Feedback extraction** -- The PM Agent identifies actionable feedback within customer segments, including feature requests, complaints, praise, and questions
4. **Issue mapping** -- Extracted feedback is matched against existing issues or used to create new ones
5. **Sanitization** -- Sensitive information (pricing discussions, contract details, personal data) is redacted before storage

### What Gets Extracted

From each call transcript, Hissuno extracts:

- **Feature requests** -- Explicit asks for new capabilities or changes
- **Pain points** -- Frustrations or workarounds the customer describes
- **Bug reports** -- Issues the customer encountered during the call
- **Competitive mentions** -- References to competitor products or features
- **Sentiment signals** -- Overall satisfaction indicators from the conversation

### Processing Time

Transcript analysis typically completes within 1-3 minutes after the transcript is available from Gong. Longer calls (60+ minutes) may take up to 5 minutes.

## Initial Import

When you first connect Gong, Hissuno imports calls matching your date filters. Use the **From Date** and **To Date** fields in the configuration dialog to control the import window. If no dates are set, Hissuno imports all available calls.

The initial import runs in the background. Large imports (hundreds of calls) may take 30-60 minutes to fully process.

## Scheduled Sync

After the initial import, Hissuno syncs calls from Gong on a scheduled basis using the sync frequency you configured (every 1 hour, 6 hours, or 24 hours). You can also set the sync frequency to manual if you prefer to trigger syncs yourself.

At each sync interval, Hissuno polls the Gong API for new or updated call transcripts within your date range and imports them for analysis. You can also trigger a sync manually at any time from the Gong integration configuration dialog.

## Customer Matching

Hissuno matches call participants to existing customer records using:

1. Email address from the Gong call metadata
2. Company name associated with the external participant
3. Phone number (if available in both systems)

Unmatched participants are created as new customer records. You can merge duplicates from the Customers tab.

## Troubleshooting

### Transcripts Not Appearing

If calls are not being imported:

- Verify that Gong has finished processing the call transcript (this can take up to a few hours on Gong's side)
- Check your call filters to ensure the call is not being excluded
- Confirm the call had at least one external participant

### Low-Quality Extractions

If the feedback extracted from transcripts is inaccurate or too broad:

- Review and refine your call type mappings
- Ensure call duration filters are excluding very short calls
- Check that speaker identification is correctly separating customer and internal speakers

### Disconnecting

To remove the Gong integration, navigate to **Integrations** in the sidebar, click **Configure** on the Gong card, and click **Disconnect**. Previously imported sessions remain in Hissuno. Revoke the Hissuno app in Gong under **Company Settings > Ecosystem > Connected Apps**.
