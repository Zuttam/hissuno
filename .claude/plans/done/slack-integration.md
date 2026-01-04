# Slack Integration Implementation Plan

## Task Prompt
we are going to implement a slack integration into the system .
Once the user integrated the hissuno slack app, they will be able
to:
1. Tag @hissuno in threads and it will kickstart the agent to join the conversation and answer any questions that rise in the thread.
2. Once a slack agent joined a channel it will monitor threads that participants that don't share the same domain as the user (the project owner) has (i.e customers) and will log these threads as sessions.
3. For now hissuno agent joins channels on-demand by the user
4. log the participant email as the user  in the session submission and any additional data you can find from slack on the user as userMetadata.
5. use /api/agent if possible as it shares the core logic

note: check slack docs for the relevant scopes needed for the app.  


##  Overview

 Implement Slack integration allowing users to:
 1. Tag @hissuno in threads for AI-powered responses
 2. Monitor threads with external participants (different email domain) as
 sessions
 3. Bot joins channels via Slack invite (on-demand)
 4. Log Slack user email + profile as userMetadata

## Design Decisions

 - Auth: OAuth Install Flow (workspace installs the app)
 - Mapping: 1:1 project-to-workspace
 - External detection: Email domain comparison
 - Channel join: Via Slack invite
 - Response mode: @mention only (silent monitoring otherwise)

##  Required Slack OAuth Scopes

 app_mentions:read    - Receive @mention events
 channels:history     - Read messages in public channels
 channels:join        - Join public channels when invited
 channels:read        - List channels and get channel info
 chat:write           - Post messages in channels
 groups:history       - Read messages in private channels
 groups:read          - List private channels
 users:read           - Get user info
 users:read.email     - Get user email addresses

 ---
## Implementation Phases

### Phase 1: Database Schema

 Migration 1: 20260105000000_add_slack_workspace_tokens.sql
 CREATE TABLE public.slack_workspace_tokens (
   id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
   project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
   workspace_id text NOT NULL,
   workspace_name text,
   workspace_domain text,
   bot_token text NOT NULL,
   bot_user_id text NOT NULL,
   installed_by_user_id text,
   installed_by_email text,
   scope text,
   created_at timestamptz DEFAULT now(),
   updated_at timestamptz DEFAULT now(),
   UNIQUE(project_id),
   UNIQUE(workspace_id)
 );
 -- Add RLS policies for project owners

 Migration 2: 20260105100000_add_slack_channels.sql
 CREATE TABLE public.slack_channels (
   id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
   workspace_token_id uuid NOT NULL REFERENCES public.slack_workspace_tokens(id)
  ON DELETE CASCADE,
   channel_id text NOT NULL,
   channel_name text,
   channel_type text DEFAULT 'channel',
   is_active boolean DEFAULT true,
   joined_at timestamptz DEFAULT now(),
   workspace_primary_domain text,
   created_at timestamptz DEFAULT now(),
   UNIQUE(workspace_token_id, channel_id)
 );

 Migration 3: 20260105200000_add_slack_thread_sessions.sql
 CREATE TABLE public.slack_thread_sessions (
   id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
   session_id text NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
   channel_id uuid NOT NULL REFERENCES public.slack_channels(id) ON DELETE
 CASCADE,
   slack_channel_id text NOT NULL,
   thread_ts text NOT NULL,
   has_external_participants boolean DEFAULT false,
   last_message_ts text,
   created_at timestamptz DEFAULT now(),
   UNIQUE(channel_id, thread_ts)
 );

 ---
### Phase 2: OAuth Flow

 Files to create:
 - /app/src/app/api/integrations/slack/connect/route.ts - OAuth initiation
 - /app/src/app/api/integrations/slack/callback/route.ts - OAuth callback

 OAuth Flow:
 1. User clicks "Connect Slack" → GET
 /api/integrations/slack/connect?projectId=xxx
 2. Redirect to Slack with scopes, state contains {projectId, userId, nonce}
 3. User authorizes → Slack redirects to /api/integrations/slack/callback
 4. Exchange code for token via https://slack.com/api/oauth.v2.access
 5. Store token in slack_workspace_tokens
 6. Redirect to project page with success

 Environment variables:
 SLACK_CLIENT_ID=
 SLACK_CLIENT_SECRET=
 SLACK_SIGNING_SECRET=
 SLACK_REDIRECT_URI=https://your-domain.com/api/integrations/slack/callback

 ---
### Phase 3: Slack Integration Library

 File: /app/src/lib/integrations/slack/index.ts
 - verifySlackRequest(body, timestamp, signature) - HMAC signature verification
 - hasSlackIntegration(supabase, projectId) - Check connection status
 - getSlackBotToken(supabase, workspaceId) - Get token for API calls
 - disconnectSlack(supabase, projectId) - Remove integration

 File: /app/src/lib/integrations/slack/client.ts
 - SlackClient class wrapping Slack Web API
 - Methods: getUserInfo(), getChannelInfo(), postMessage(), getThreadMessages()

 ---
### Phase 4: Event Handling (Webhooks)

 File: /app/src/app/api/integrations/slack/events/route.ts

 Handle Slack Events API webhooks:
 1. Verify request signature using SLACK_SIGNING_SECRET
 2. Handle url_verification challenge
 3. Route events to handlers:
   - app_mention → Agent responds to user
   - message → Monitor for external participants
   - member_joined_channel → Track bot joining channels

 File: /app/src/lib/integrations/slack/event-handlers.ts
 - handleSlackEvent() - Main router
 - handleBotJoinedChannel() - Record channel in database

 File: /app/src/lib/integrations/slack/message-processor.ts
 - processSlackMention() - Handle @mentions, call triggerChatRun directly, post response
 - processSlackMessage() - Silent monitoring, detect external participants, log sessions
 - waitForChatRunCompletion() - Poll chat_runs table until status is complete/failed

 ---
### Phase 5: Agent Integration (Core Logic Extraction)

 **Note:** The current /api/agent route is widget-specific (CORS, origin checking,
 hardcoded source: 'widget'). Instead of modifying it, we'll extract core logic.

 **Create:** /app/src/lib/agent/agent-service.ts
 - Extract `triggerChatRun` logic into a reusable service
 - Accept source parameter ('widget' | 'slack' | etc.)
 - Both /api/agent and Slack handler will use this service

 **Session ID format:** slack_{team_id}_{channel_id}_{thread_ts}

 **User metadata structure:**
 {
   slack_user_id: string,
   slack_channel_id: string,
   slack_workspace_id: string,
   email?: string,
   name?: string,
   display_name?: string,
   is_external?: 'true'
 }

 **Flow for @mention (different from widget - no SSE streaming):**
 1. Receive app_mention event
 2. Immediately respond with 200 to Slack (within 3s requirement)
 3. Fetch thread history via conversations.replies
 4. Convert to messages array (determine role by comparing to bot_user_id)
 5. Call upsertSession with source: 'slack'
 6. Call triggerChatRun directly (not via HTTP)
 7. Poll/wait for chat run completion
 8. Post response to Slack thread via chat.postMessage

 **Key difference from widget:**
 - Widget: SSE streaming to browser
 - Slack: Background processing + post response to thread when complete

 ---
### Phase 6: API Routes

 File: /app/src/app/api/integrations/slack/route.ts
 - GET ?projectId=xxx - Check connection status
 - DELETE ?projectId=xxx - Disconnect integration

 File: /app/src/app/api/integrations/slack/channels/route.ts
 - GET ?projectId=xxx - List active channels

 ---
### Phase 7: UI Components

 Update: /app/src/components/projects/project-detail/integrations-section.tsx
 - Replace "Coming Soon" badge with actual connection status
 - Add Connect/Disconnect buttons
 - Show workspace name when connected
 - Show last activity (similar to widget integration)

 The existing file already has a placeholder:
 ```tsx
 {/* Slack Integration */}
 <div className="flex items-center gap-x-6">
   <StatusIndicator status="inactive" />
   <span>Slack Integration</span>
   <Badge variant="default">Coming Soon</Badge>
 </div>
 ```

 ---
 File Structure Summary

 app/src/
 ├── app/api/integrations/slack/
 │   ├── route.ts              # GET/DELETE status
 │   ├── connect/route.ts      # OAuth initiation
 │   ├── callback/route.ts     # OAuth callback
 │   ├── events/route.ts       # Slack Events API webhook
 │   └── channels/route.ts     # List channels
 ├── lib/integrations/slack/
 │   ├── index.ts              # Core utilities (verify, hasIntegration, etc.)
 │   ├── client.ts             # Slack API client wrapper
 │   ├── event-handlers.ts     # Event routing
 │   └── message-processor.ts  # Message handling + agent integration
 └── components/projects/project-detail/
     └── integrations-section.tsx  # Update existing (add Slack section)

 app/supabase/migrations/
 ├── 20260105000000_add_slack_workspace_tokens.sql
 ├── 20260105100000_add_slack_channels.sql
 └── 20260105200000_add_slack_thread_sessions.sql

 ---
 Critical Files Reference

 | File | Notes |
 |------|-------|
 | /app/src/lib/integrations/github.ts | Pattern reference for integration lib |
 | /app/src/lib/supabase/sessions.ts | Already supports source: 'slack' ✓ |
 | /app/src/types/session.ts | SessionSource type includes 'slack' ✓ |
 | /app/src/lib/agent/chat-run-service.ts | triggerChatRun - will be called directly |
 | /app/src/app/api/agent/route.ts | Reference only - Slack won't use this route |
 | /app/src/components/projects/project-detail/integrations-section.tsx | Add Slack UI |

 ---
## Implementation Order

 1. Create database migrations (3 files)
 2. Create Slack lib core utilities (/lib/integrations/slack/index.ts)
 3. Create Slack API client wrapper (/lib/integrations/slack/client.ts)
 4. Implement OAuth flow (connect + callback routes)
 5. Implement status route (GET/DELETE /api/integrations/slack)
 6. Implement events webhook (/api/integrations/slack/events)
 7. Implement event handlers + message processor (calls triggerChatRun directly)
 8. Update integrations-section.tsx UI
 9. Test end-to-end with real Slack workspace