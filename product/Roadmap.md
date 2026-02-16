# Tasks

## Phase 1

[x] Test welcome email
[x] Test limits enforcement  
[x] Test downgrade and upgrade  
[x] Setup & Test analytics  
[x] Test upload session messages from json
[x] Add TOS  
[x] Add join list

## Phase 2

### Platform
[x] g-suite 
[x] Deploy to prod
    - resend
    - supabas
    - vercel (enable cron)
    - slack
    - lemon squeezy 
    - github
    - openai 
    - posthog

## Phase 3

[x] Add widget variants: right side drawer (sticky badge), headless, dialog with shortcut (cmd+k)
[x] Analytics
[x] npm deploy widget
[x] Improve issues: specs generation, filters, layout, fix streaming bug
[x] Make hissuno mobile friendly 


## Phase 4

### Marketing
[x] Add book a call via calendly

### Sessions 
[x] support session naming 
[x] Test session lifecycle 

### Platform 
[x] Move cron execution to github action (free) 

## Phase 5

### Marketing
[x] Improve landing page
[x] setup google and meta tracking (including join the waitlist and calendly)

### Platform
[x] Improve layout: module tabs under project, settings and edit mode
[x] Test limits (analyzed sessions)
[x] Simplify Project creation - Just provide name and description (check limits + enforcement)
[x] Move hissuno LS store out of test and update secrets 

### Analytics
[x] Add waterfall graph of customer impact on issues

### Issues
[x] Improve analysis with code
  [x] Deduplication 
  [x] Sensitivity / Impact
  [x] Add estimation (effort) 
[x] Export CSV 

### Sessions
[x] Export CSV 


## Phase 6

### Knowledge
[x] Seperate knowledge sources and knowledge package -> allow user to create multiple packages from various sources and connect the agents to relevant knowledge package

### Marketing
[x] Launch Ad campaigns for join and demo CTA (google and meta)
[x] Test pixel

### Support
[x] Slack auto response (no need to tag in thread)

### Sessions
[x] Slack as source only (read only sessions from channels)
[x] Intercom integration (API Key - https://developers.intercom.com/docs/references/rest-api/api.intercom.io)


## Phase 7

### Marketing
[x] Ads for AI Support
[x] Ads for AI FDE

### Support
[x] alert and interact in slack for open sessions -  support sessions go to a centeralize channel in slack, the user can answer in the relevant thread in slack which replies in the session to the user
[x] Fix automatic close session cron in prod
[x] Improve human takeover mechanism (e.g Add waiting for human status)

### Sessions
[x] Gong integration (API Key - https://gong.app.gong.io/settings/api/documentation#overview)
[x] Expend sessions type to different use cases: behavioral session (events), meeting (multi user conversation like gong -> show transcript), chat (intercom, widget) and show the contents accordingly 


### Platform 
[x] Improve onboarding 
[x] Add invite link support
[x] Move knowledge into agents screen
[x] Implement basic alert/notification system

## Phase 8

### Feedback
[x] Make each source badge and icon badge (also in filters)
[x] Check session lifecycle for closed sessions (from integrations)

### Customers 
[x] Introduce new screen to manage contact and company data. 

### Issues
[x] Issue review process:
  - issue velocity - times mentioned in given sliding window
  - issue impact - analysis based on customer and product area (+ guidelines)
  - issue effort - grounded with codebase 
[x] Add in PM Specialist the option for review guidelines (address specific fields) 
[x] Keep Spec genration manual  
[x] show customer data as part of the review 


### Platform
[x] Add coming soon of crm integrations (hubspot and salesforce)
[x] Improve onboarding experience
[x] Improve welcome email visualization
[x] Alerts and in app notifications (email, slack)


## Phase 9

### Feedback (f.k.a sessions)
[x] Improve customer view inside a feedabck
[x] support batch operation
[x] Intercom oauth

### Marketing
[x] Docs portal

### Support
[x] Add Hissuno toolset to Support agent  

### Platform
[x] Project multi-users access and RBAC
[x] Add dimension of analyzed issues 
[x] Fix API Access - support api keys
[x] MCP Access

### Analytics
[x] segmentation by customer (contact and company)

## Phase 10

### Marketing
[] Run SDR agent
[] Improve landing pages | remove ai support and fde | focus on pm | add pricing

### Feedback (f.k.a sessions)
[] Support Zendesk in early access


### Platform
[] Delete project

### Issues
[] Draft email response to users
[] Lieaner Integration


## Phase 11

### Marketing 
[] Support promotions

### Integrations
[] Decide on RBAC integrations access for members

### Feedback (f.k.a sessions)
[] Add posthog sessions support

### Suport
[] Email agent

### Code
[] Create initial implementation 

### Platform
[] Move from cron to webhook to handle session analysis as events and create a solution for skipeed sessions when user upgrades/limit increased
[] MCP Apps


### Issues 
[] Jira Integration 
[] Add product area to the issue analysis - Classify on product area


### Analytics 
[] segmentation by product area

### Customers
[] Implement CRM integration