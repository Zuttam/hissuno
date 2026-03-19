---
title: "Review Workflow"
description: "How Hissuno's AI-powered review pipeline turns customer feedback into tracked engineering issues."
---

## Overview

The session review workflow is the automated pipeline that transforms closed feedback sessions into actionable engineering work. It combines AI classification, contact resolution, duplicate detection, and a Product Manager agent that decides whether each session warrants a new issue, an upvote on an existing issue, or no action.

The workflow is triggered automatically when a session closes and can also be run manually from the dashboard for any session.

## Workflow Steps

The review pipeline executes six sequential steps:

### 1. Classify Session

The **Tagging Agent** analyzes the conversation and applies classification tags. It receives the full session messages along with the project's built-in tags, custom tags, and any classification guidelines.

The agent evaluates the conversation against each tag's criteria and returns a JSON response with the selected tags and reasoning. Tags are validated against the allowed set (built-in plus custom) before being saved.

Sessions can receive multiple tags. For example, a conversation where a customer reports a bug and expresses frustration would be tagged as both **Bug** and **Loss**.

If the Tagging Agent is unavailable, the workflow continues without classification rather than failing.

### 2. Prepare PM Context

This step fetches all the data the PM agent needs to make its decision:

- The full session record with metadata
- All session messages
- Project settings including whether issue tracking is enabled
- The tags applied in the classification step

If the project has issue tracking disabled, the workflow skips the remaining steps and marks the session as reviewed.

Sessions with fewer than three messages are also skipped, as they typically lack sufficient context for meaningful analysis.

### 3. Resolve Contact

The workflow matches the session to a customer contact by looking up the email address from the session's user metadata. This step is deterministic (no AI involved):

- If a contact with a matching email exists, the session is linked to it
- If no contact exists but an email is available, a new contact record is created automatically
- If no email is available, this step is skipped

Contact resolution enables you to track feedback per customer and per company across all sessions.

### 4. Find Duplicates

Before creating a new issue, the workflow searches for similar existing issues using semantic similarity. The session's content is converted to a vector embedding and compared against the embeddings of all open issues in the project.

Issues with a similarity score above the configured threshold (typically 70%) are returned as candidates for upvoting instead of creating a duplicate.

### 5. PM Decision

The **Product Manager Agent** receives the enriched context and makes one of three decisions:

#### Skip

The agent determines that no engineering action is needed. This happens when:

- The session is a simple Q&A that was fully resolved
- The feedback is positive without actionable items (e.g., tagged only as **Win**)
- The conversation is off-topic or lacks substance
- Issue tracking is disabled for the project

The skip reason is recorded for transparency.

#### Upvote

If a similar issue was found with a similarity score of 70% or higher, the agent recommends upvoting the existing issue instead of creating a duplicate. The upvote:

- Increments the issue's upvote count
- Links the session to the existing issue
- Triggers an issue re-analysis workflow to update impact scores

#### Create

If the session contains actionable feedback and no similar issue exists, the agent creates a new issue with:

- **Type**: Bug, feature request, or change request
- **Title**: A clear, concise summary
- **Description**: Detailed explanation with customer quotes from the conversation
- **Priority**: Low, medium, or high based on impact and customer sentiment

The new issue is saved with a vector embedding for future duplicate detection, and an issue analysis workflow is triggered to compute impact and effort scores.

### Tag Hints

The PM agent receives hints based on the classification tags to guide its decision:

| Tag | Hint |
|-----|------|
| Bug | Suggests creating an issue with type `bug` |
| Feature Request | Suggests creating with type `feature_request` |
| Change Request | Suggests creating with type `change_request` |
| Loss | Indicates user frustration, consider higher priority |
| Win (alone) | Likely a skip candidate |
| General Feedback | Evaluate carefully, may not be actionable |

### 6. Execute Decision

The final step carries out whatever the PM agent decided:

- **Skip**: Marks the session as reviewed with the skip reason
- **Upvote**: Calls the issue service to increment the vote count and link the session
- **Create**: Calls the issue service to create the new issue, generate its embedding, and link the session

Regardless of the decision, the session's `pm_reviewed_at` timestamp is set, marking it as processed.

## Manual Review

You can review sessions manually from the dashboard without waiting for the automated workflow:

1. Open a closed session from the feedback list
2. View the conversation and any auto-applied tags
3. Adjust tags if the automated classification is incorrect
4. Manually create an issue or link the session to an existing one
5. Mark the session as reviewed

Manual review is useful for sessions that were skipped by the automated workflow but contain feedback you want to act on.

## Linking Feedback to Issues

Every issue in Hissuno tracks which feedback sessions contributed to it. This creates a direct connection between customer voices and engineering work:

- **New issues** are linked to the session that triggered their creation
- **Upvoted issues** accumulate links to every session where a customer reported the same problem
- **Session detail view** shows all linked issues with their current status and upvote count

This linkage lets engineers read the original customer conversations for context, and lets product managers see which issues have the most customer evidence behind them.

## Issue Analysis

After an issue is created or upvoted, an **Issue Analysis workflow** runs in the background to compute impact and effort scores based on the feedback content, customer sentiment, and technical complexity. These scores help your team prioritize issues based on quantitative analysis.

## Review Settings

You can configure review behavior in your project:

- **Issue tracking enabled/disabled**: When disabled, the PM agent skips all sessions without creating issues
- **Custom tags and guidelines**: Influence how sessions are classified
- **Similarity threshold**: Controls how aggressively duplicates are detected

## Monitoring Reviews

The feedback list shows each session's review status: **Reviewed** (PM agent has processed it), **Pending review** (closed but not yet reviewed), and the number of **linked issues**. You can filter the list to show only unreviewed sessions or sessions with linked issues to quickly find feedback that needs attention.
