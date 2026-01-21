# Intelligent Slack Thread Subscription

## Goal
Once the bot is mentioned in a thread, it "subscribes" to that thread and intelligently decides whether to respond to subsequent messages (without requiring re-tagging).

## Approach
1. **Heuristics first** - Quick pattern matching for obvious cases
2. **Bot-was-last-responder = respond** - Follow-ups after bot response are treated as directed at bot
3. **Lightweight classifier for uncertain cases** - gpt-4o-mini agent for ambiguous messages
4. **Silent when appropriate** - Don't respond to human-to-human conversation

---

## Current Architecture Summary

### Existing Files
- [event-handlers.ts](app/src/lib/integrations/slack/event-handlers.ts) - Routes Slack events (`app_mention`, `message`, `member_joined_channel`)
- [message-processor.ts](app/src/lib/integrations/slack/message-processor.ts) - Contains `processSlackMention()` and `processSlackMessage()` (external participant detection)
- [index.ts](app/src/lib/integrations/slack/index.ts) - Helper functions (`getOrCreateThreadSession`, `updateThreadSessionLastMessage`, etc.)
- [client.ts](app/src/lib/integrations/slack/client.ts) - Slack Web API wrapper

### Current `handleMessage` Behavior (lines 187-226)
Currently only monitors for **external participants** - does NOT respond to messages in subscribed threads.

### Current `slack_thread_sessions` Schema
```sql
id, session_id, channel_id, slack_channel_id, thread_ts,
has_external_participants, last_message_ts, created_at
```
**Missing:** `last_responder_type`, `last_bot_response_ts`

### Mastra Agent Registration Pattern
Agents are imported and added to the `agents` object in [mastra/index.ts](app/src/mastra/index.ts:34-45).

---

## Implementation Steps

### 1. Database Migration
**New file:** `app/supabase/migrations/[timestamp]_add_slack_thread_response_tracking.sql`

```sql
-- Add tracking columns for intelligent thread response decisions
ALTER TABLE public.slack_thread_sessions
ADD COLUMN last_responder_type text CHECK (last_responder_type IN ('bot', 'user')),
ADD COLUMN last_bot_response_ts text;

-- Add index for faster lookups when checking if thread is subscribed
CREATE INDEX IF NOT EXISTS idx_slack_thread_sessions_lookup
ON public.slack_thread_sessions(channel_id, thread_ts);

COMMENT ON COLUMN public.slack_thread_sessions.last_responder_type IS 'bot or user - who sent the last message in this thread';
COMMENT ON COLUMN public.slack_thread_sessions.last_bot_response_ts IS 'Slack ts of the last bot response in this thread';
```

### 2. Response Decision Service
**New file:** `app/src/lib/integrations/slack/response-decision.ts`

Create `decideIfShouldRespond(params)` function with this logic:

| Check | Result | Confidence |
|-------|--------|------------|
| Bot directly mentioned `<@BOT_ID>` | RESPOND | high |
| Another user mentioned `<@OTHER_USER>` | SKIP | high |
| Bot was last responder | RESPOND | high |
| Human takeover phrases ("I'll handle this", "let me take over", "I got this") | SKIP | high |
| Uncertain | → Call classifier agent | - |

**Interface:**
```typescript
type ResponseDecision = {
  shouldRespond: boolean
  confidence: 'high' | 'medium' | 'low'
  reason: string
  usedClassifier: boolean
}

type DecisionParams = {
  text: string
  botUserId: string
  lastResponderType: 'bot' | 'user' | null
  threadHistory?: SlackMessage[]  // optional, for classifier context
}

export async function decideIfShouldRespond(params: DecisionParams): Promise<ResponseDecision>
```

### 3. Response Classifier Agent
**New file:** `app/src/mastra/agents/response-classifier-agent.ts`

Lightweight gpt-4o-mini agent for ambiguous cases:

```typescript
import { Agent } from '@mastra/core/agent'

export const responseClassifierAgent = new Agent({
  name: 'Response Classifier',
  instructions: `You analyze Slack messages to determine if they are directed at a support bot.

You will receive:
- The new message text
- Recent thread history (for context)
- Who sent the last message (bot or human)

Return JSON:
{
  "should_respond": true|false,
  "confidence": "high"|"medium"|"low",
  "reasoning": "brief explanation"
}

Guidelines:
- Questions about previous bot responses → respond
- Follow-up clarifications after bot → respond
- Human-to-human conversation → skip
- Generic thank you messages → skip (unless asking follow-up)
- Messages with "?" directed at bot → respond
- Off-topic side conversations → skip`,
  model: 'openai/gpt-4o-mini',  // Lightweight model for speed
  tools: {},
})
```

**Register in [mastra/index.ts](app/src/mastra/index.ts):**
- Import: `import { responseClassifierAgent } from './agents/response-classifier-agent'`
- Add to agents object at line 44: `responseClassifierAgent,`

### 4. Update handleMessage
**File:** [event-handlers.ts](app/src/lib/integrations/slack/event-handlers.ts) (modify `handleMessage` at lines 187-226)

**Current behavior:** Only detects external participants
**New behavior:** Also responds to subscribed threads

```typescript
async function handleMessage(params: { ... }): Promise<void> {
  const { event, projectId, botUserId, slackClient, supabase, teamId } = params

  // Only monitor threaded messages
  if (!event.thread_ts || !event.channel || !event.ts) {
    return
  }

  const channel = await getSlackChannel(supabase, teamId, event.channel)
  if (!channel) {
    return
  }

  // NEW: Check if thread is subscribed (has session record)
  const threadSession = await getThreadSession(supabase, channel.id, event.thread_ts)

  if (threadSession) {
    // Thread is subscribed - decide if we should respond
    const decision = await decideIfShouldRespond({
      text: event.text || '',
      botUserId,
      lastResponderType: threadSession.lastResponderType,
    })

    if (decision.shouldRespond) {
      // Trigger response via processSlackThreadResponse
      await processSlackThreadResponse({
        projectId,
        channelId: event.channel,
        channelDbId: channel.id,
        threadTs: event.thread_ts,
        messageTs: event.ts,
        userId: event.user,
        text: event.text || '',
        botUserId,
        slackClient,
        supabase,
        teamId,
        existingSessionId: threadSession.sessionId,
        threadSessionId: threadSession.id,
      })
    } else {
      // Update metadata only (mark user as last responder)
      await updateThreadSessionResponder(supabase, threadSession.id, 'user')
    }
    return
  }

  // EXISTING: External participant detection (unchanged)
  await processSlackMessage({ ... })
}
```

### 5. Add Thread Response Processor
**File:** [message-processor.ts](app/src/lib/integrations/slack/message-processor.ts)

Add `processSlackThreadResponse()` - similar to `processSlackMention()` but:
- Uses existing session ID (no generation)
- Updates `last_responder_type = 'bot'` after response
- Updates `last_bot_response_ts`

```typescript
type ProcessThreadResponseParams = {
  projectId: string
  channelId: string
  channelDbId: string
  threadTs: string
  messageTs: string
  userId?: string
  text: string
  botUserId: string
  slackClient: SlackClient
  supabase: ReturnType<typeof createAdminClient>
  teamId: string
  existingSessionId: string  // Already have session
  threadSessionId: string    // Already have thread session record
}

export async function processSlackThreadResponse(params: ProcessThreadResponseParams): Promise<void> {
  // Similar to processSlackMention but:
  // 1. Skip session creation (use existingSessionId)
  // 2. After posting response, call updateThreadSessionResponder(id, 'bot', messageTs)
}
```

### 6. Track Responder Type
**File:** [message-processor.ts](app/src/lib/integrations/slack/message-processor.ts)

After bot responds in both `processSlackMention()` and `processSlackThreadResponse()`:

```typescript
// After slackClient.postMessage() succeeds, around line 202-206
await updateThreadSessionResponder(supabase, threadSessionId, 'bot', postedMessageTs)
```

Also update `updateSessionActivity(sessionId)` call to include responder tracking.

### 7. Helper Functions
**File:** [index.ts](app/src/lib/integrations/slack/index.ts)

Add after line 365:

```typescript
/**
 * Get thread session by channel and thread_ts
 */
export async function getThreadSession(
  supabase: SupabaseClient<Database> | AnySupabase,
  channelDbId: string,
  threadTs: string
): Promise<{
  id: string
  sessionId: string
  lastResponderType: 'bot' | 'user' | null
  lastBotResponseTs: string | null
} | null> {
  const client = supabase as AnySupabase
  const { data, error } = await client
    .from('slack_thread_sessions')
    .select('id, session_id, last_responder_type, last_bot_response_ts')
    .eq('channel_id', channelDbId)
    .eq('thread_ts', threadTs)
    .single()

  if (error || !data) {
    return null
  }

  return {
    id: data.id,
    sessionId: data.session_id,
    lastResponderType: data.last_responder_type,
    lastBotResponseTs: data.last_bot_response_ts,
  }
}

/**
 * Update thread session responder type and timestamp
 */
export async function updateThreadSessionResponder(
  supabase: SupabaseClient<Database> | AnySupabase,
  threadSessionId: string,
  responderType: 'bot' | 'user',
  botResponseTs?: string
): Promise<void> {
  const client = supabase as AnySupabase
  const updates: Record<string, string> = {
    last_responder_type: responderType,
  }
  if (responderType === 'bot' && botResponseTs) {
    updates.last_bot_response_ts = botResponseTs
  }

  await client
    .from('slack_thread_sessions')
    .update(updates)
    .eq('id', threadSessionId)
}
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `app/supabase/migrations/[timestamp]_add_slack_thread_response_tracking.sql` | **NEW** - Add columns to slack_thread_sessions |
| `app/src/lib/integrations/slack/response-decision.ts` | **NEW** - Decision logic with heuristics |
| `app/src/mastra/agents/response-classifier-agent.ts` | **NEW** - Lightweight gpt-4o-mini classifier |
| [mastra/index.ts](app/src/mastra/index.ts:7-14) | Import and register `responseClassifierAgent` |
| [event-handlers.ts](app/src/lib/integrations/slack/event-handlers.ts:187-226) | Update `handleMessage` to check subscriptions and decide |
| [message-processor.ts](app/src/lib/integrations/slack/message-processor.ts) | Add `processSlackThreadResponse()`, update `processSlackMention()` to track responder |
| [index.ts](app/src/lib/integrations/slack/index.ts:365+) | Add `getThreadSession()`, `updateThreadSessionResponder()` |

---

## Response Decision Flow

```
Message in thread (not @mention)
         │
         ▼
┌─────────────────────┐
│ Thread subscribed?  │──no──▶ External participant check (existing)
│ (has session)       │
└─────────────────────┘
         │ yes
         ▼
┌─────────────────────┐
│ Bot mentioned?      │──yes──▶ RESPOND
│ <@BOT_ID>           │
└─────────────────────┘
         │ no
         ▼
┌─────────────────────┐
│ Other user @'d?     │──yes──▶ SKIP (update last_responder=user)
│ <@OTHER_USER>       │
└─────────────────────┘
         │ no
         ▼
┌─────────────────────┐
│ Bot was last        │──yes──▶ RESPOND
│ responder?          │
└─────────────────────┘
         │ no
         ▼
┌─────────────────────┐
│ Human takeover      │──yes──▶ SKIP (update last_responder=user)
│ detected?           │
└─────────────────────┘
         │ no
         ▼
┌─────────────────────┐
│ Classifier agent    │
│ (gpt-4o-mini)       │──▶ RESPOND or SKIP
└─────────────────────┘
```

---

## Testing Considerations

1. **Unit tests for response-decision.ts:**
   - Bot mention detection
   - Other user mention detection
   - Human takeover phrase detection
   - Classifier integration

2. **Integration test scenarios:**
   - Bot mentioned → responds
   - User replies after bot → responds
   - User @mentions another user → silent
   - "I'll handle this" → silent
   - Ambiguous message → classifier decides

3. **Edge cases:**
   - Thread where bot has never responded
   - Very long threads (context window for classifier)
   - Rapid successive messages