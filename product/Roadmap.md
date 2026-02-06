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
[] alert and interact in slack for open sessions -  support sessions go to a centeralize channel in slack, the user can answer in the relevant thread in slack which replies in the session to the user
[x] Fix automatic close session cron in prod
[x] Improve human takeover mechanism (e.g Add waiting for human status)

### Sessions
[] Gong integration (API Key - https://gong.app.gong.io/settings/api/documentation#overview)

[] Expend sessions type to different use cases: behavioral session (events), meeting (multi user conversation like gong -> show transcript), chat (intercom, widget) and show the contents accordingly


### Platform 
[x] Improve onboarding 
[x] Add invite link support
[x] Move knowledge into agents screen
[x] Implement basic alert/notification system

## Phase 8

### Suport
[] Email agent

### Marketing
[] Run SDR agent
[] Change theme to Samurai Pirate
[] Docs portal

### Issues
[] Calculate issue upvotes over time and alert or change priority if there's an anomaly
[] Lieaner Integration
[] Jira Integration 

### Code
[] Create initial implementation 

### Platform
[] API Access - support api keys and move cron to rely on admin api key value (change env var)
[] Improve welcome email visualization
[] Project multi-users access and RBAC
[] Alerts and weekly reports(email, slack)
[] MCP Access
[] MCP Apps

## Phase 9

### Marketing
[] Ad Campaign for AI FDE 
[] Support promotions

### Sessions
[] Improve participants identification - show additional details in a cleaner way
[] Facebook community channels

### Platform
[] Project multi-users access and RBAC
[] Alerts and weekly reports(email, slack)
[] MCP Access
[] MCP Apps

### Issues
[] Support Actions items (not necessary code related)
[] Draft response email to the user