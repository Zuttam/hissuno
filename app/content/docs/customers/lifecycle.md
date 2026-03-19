---
title: "Customer Lifecycle"
description: "Track customer lifecycle stages, monitor account health through feedback patterns, and filter by lifecycle status."
---

## Overview

Understanding where each customer sits in their lifecycle is essential for prioritizing the right feedback. A bug reported by an expansion-stage customer with $200K ARR carries different weight than the same bug reported by a prospect evaluating your product. Hissuno tracks lifecycle stages on company records and uses this data directly in the issue prioritization algorithm, ensuring your engineering backlog reflects real business priorities.

## Lifecycle Stages

Every company in Hissuno is assigned one of five lifecycle stages. These stages represent the customer's current relationship with your product.

### Prospect

The company is evaluating your product but has not yet committed. They may be in a trial period or conducting a proof of concept. Feedback from prospects often focuses on onboarding experience, missing features compared to competitors, and initial impressions.

**Prioritization weight:** 0.8x. Prospect feedback is valuable for understanding market fit but carries lower weight in the impact algorithm since there is no revenue at risk.

### Onboarding

The company has committed to your product and is in the process of deploying it. Feedback during onboarding tends to highlight setup friction, documentation gaps, and early usability issues. Addressing onboarding feedback is critical for activation and time-to-value.

**Prioritization weight:** 1.0x (baseline). Onboarding customers represent recent revenue commitments, and their success directly impacts retention.

### Active

The company is using your product in production. This is the steady-state stage where most feedback is generated. Active customers provide the most reliable signals about product quality, since they interact with your product regularly and have deep familiarity with its capabilities and limitations.

**Prioritization weight:** 1.2x. Active customers represent stable revenue and their feedback reflects real production usage patterns.

### Expansion

The company is growing their usage of your product -- adding seats, upgrading plans, or adopting new features. Feedback from expansion customers is especially valuable because these accounts represent increasing revenue and their satisfaction directly drives growth.

**Prioritization weight:** 1.3x (highest). Expansion customers are your best growth signal. Issues blocking their adoption of new capabilities deserve high priority.

### Churned

The company has stopped using your product or has not renewed their contract. Feedback from churned customers, when available, provides insight into why they left. While you may not be able to win them back, their feedback can help prevent similar churn from other accounts.

**Prioritization weight:** 1.1x. Slightly above baseline because churn signals often point to systemic issues that may affect other customers.

## Setting and Updating Stages

### Manual Assignment

You can set a company's lifecycle stage from the company detail sidebar. Click the Stage field, select the new stage from the dropdown, and confirm. The change takes effect immediately and will influence priority calculations for any issues linked to that company's contacts going forward.

### During Import

When importing companies via CSV, you can map a column to the Stage field. Accepted values are: `prospect`, `onboarding`, `active`, `churned`, and `expansion`. Rows with unrecognized stage values will default to `prospect`.

### Through the API

Set the `stage` field when creating or updating a company via the API:

```json
{
  "name": "Acme Corp",
  "domain": "acme.com",
  "stage": "active",
  "arr": 120000
}
```

## How Stages Affect Prioritization

Lifecycle stages flow into the issue prioritization system through the impact scoring algorithm. When computing the customer impact score for an issue, the system examines all linked feedback sessions and their associated companies.

The stage weighting works as follows:

1. Each linked session is traced to its contact and their company.
2. The company's stage is looked up and mapped to a weight multiplier.
3. The highest weight among all linked companies contributes a bonus to the impact score.
4. This stage bonus accounts for roughly 10% of the customer impact component.

Combined with ARR data (60% weight) and customer breadth (30% weight), lifecycle stages provide nuance beyond pure revenue numbers. A $50K expansion account may generate a higher impact score than a $75K active account because the expansion multiplier signals growth potential.

## Tracking Customer Health Through Feedback Patterns

While Hissuno does not compute a health score automatically, feedback patterns provide strong signals about account health that you can use alongside the built-in health score field.

### Signals of Declining Health

- **Increasing bug reports** -- A customer who starts reporting more bugs may be hitting scaling issues or encountering quality problems that could lead to churn.
- **Shift from feature requests to complaints** -- Healthy customers request features to grow their usage. When requests shift to complaints and frustration, it signals declining satisfaction.
- **`losses` tag frequency** -- Sessions tagged with `losses` indicate negative experiences. Multiple loss-tagged sessions from the same company over a short period is a warning sign.
- **Decreased feedback volume** -- Counterintuitively, a sudden drop in feedback from a previously active customer can signal disengagement.

### Signals of Positive Health

- **`wins` tag frequency** -- Sessions tagged with `wins` indicate the customer is achieving success with your product.
- **Feature request patterns** -- Customers requesting advanced features are typically deeply engaged and looking to expand their usage.
- **Champion contacts** -- Active champions who regularly provide constructive feedback indicate a healthy relationship.

## Lifecycle-Based Filtering

### Company Filters

The company list view supports filtering by lifecycle stage. Click the **Stage** filter dropdown and select one or more stages to narrow the view. This is useful for:

- Reviewing all churned companies to understand common exit reasons.
- Focusing on expansion accounts to identify and address blockers.
- Monitoring onboarding companies to ensure smooth activation.

### Feedback Session Filters

You can filter feedback sessions by company to see all conversations associated with customers in a particular lifecycle stage. From the feedback list, use the company filter to select a specific company, or navigate to a company's detail view to see all of their sessions.

### Issue Impact Visibility

Each issue's detail view shows the companies affected by that issue, including their lifecycle stage and ARR. This gives you immediate visibility into which customer segments are impacted by any given problem or request.

## Reporting

The Customers overview provides aggregate metrics broken down by lifecycle stage:

- **Company count by stage** -- How many companies are in each lifecycle phase, shown as both absolute numbers and percentages.
- **ARR by stage** -- How revenue is distributed across lifecycle stages.
- **Contact distribution** -- How contacts are spread across companies in different stages.

These metrics help you understand the composition of your customer base and identify stages where feedback is concentrated, which may indicate systematic issues or opportunities for improvement at that phase of the customer journey.
