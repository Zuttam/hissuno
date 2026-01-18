# Intelligent Slack Thread Subscription

## Goal
Once the bot is mentioned in a thread, it "subscribes" to that thread and intelligently decides whether to respond to subsequent messages (without requiring re-tagging).

## Approach
1. **Heuristics first** - Quick pattern matching for obvious cases
2. **Bot-was-last-responder = respond** - Follow-ups after bot response are treated as directed at bot
3. **Lightweight classifier for uncertain cases** - gpt-4o-mini agent for ambiguous messages
4. **Silent when appropriate** - Don't respond to human-to-human conversation

---

## Implementation Steps

### 1. Database Migration
**File:** `app/supabase/migrations/[timestamp]_add_slack_thread_response_tracking.sql`

Add tracking columns to `slack_thread_sessions`:
```sql
ALTER TABLE public.slack_thread_sessions
ADD COLUMN last_responder_type text CHECK (last_responder_type IN ('bot', 'user')),
ADD COLUMN last_bot_response_ts text;
```

### 2. Response Decision Service
**New file:** `app/src/lib/integrations/slack/response-decision.ts`

Create `decideIfShouldRespond(params)` function with this logic:

| Check | Result | Confidence |
|-------|--------|------------|
| Bot directly mentioned `<@BOT_ID>` | RESPOND | high |
| Another user mentioned `<@OTHER_USER>` | SKIP | high |
| Bot was last responder | RESPOND | high |
| Human takeover phrases ("I'll handle this") | SKIP | high |
| Uncertain | → Call classifier agent | - |

### 3. Response Classifier Agent
**New file:** `app/src/mastra/agents/response-classifier-agent.ts`

Lightweight gpt-4o-mini agent that returns:
```json
{ "should_respond": true|false, "confidence": "high|medium|low", "reasoning": "..." }
```

Register in `app/src/mastra/index.ts`.

### 4. Update handleMessage
**File:** `app/src/lib/integrations/slack/event-handlers.ts` (lines 187-226)

Modify `handleMessage` to:
1. Check if thread is subscribed (has `slack_thread_sessions` record)
2. If subscribed → call `decideIfShouldRespond()`
3. If should respond → trigger full agent response
4. If not → update metadata only

### 5. Add Thread Response Processor
**File:** `app/src/lib/integrations/slack/message-processor.ts`

Add `processSlackThreadResponse()` - similar to `processSlackMention()` but uses existing session.

### 6. Track Responder Type
**File:** `app/src/lib/integrations/slack/message-processor.ts`

After bot responds in `processSlackMention()` and `processSlackThreadResponse()`:
- Update `last_responder_type = 'bot'`
- Update `last_bot_response_ts`

### 7. Helper Functions
**File:** `app/src/lib/integrations/slack/index.ts`

Add:
- `getThreadSession(supabase, channelDbId, threadTs)` - lookup existing thread session
- `updateThreadSessionMetadata(supabase, id, updates)` - update tracking fields

---

## Files to Modify

| File | Changes |
|------|---------|
| `app/supabase/migrations/[new].sql` | Add columns to slack_thread_sessions |
| `app/src/lib/integrations/slack/response-decision.ts` | NEW - decision logic |
| `app/src/mastra/agents/response-classifier-agent.ts` | NEW - lightweight classifier |
| `app/src/mastra/index.ts` | Register new agent |
| `app/src/lib/integrations/slack/event-handlers.ts` | Update handleMessage |
| `app/src/lib/integrations/slack/message-processor.ts` | Add processSlackThreadResponse, track responder |
| `app/src/lib/integrations/slack/index.ts` | Add helper functions |

---

## Response Decision Flow

```
Message in subscribed thread
         │
         ▼
┌─────────────────────┐
│ Bot mentioned?      │──yes──▶ RESPOND
└─────────────────────┘
         │ no
         ▼
┌─────────────────────┐
│ Other user @'d?     │──yes──▶ SKIP
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
│ Human takeover      │──yes──▶ SKIP
│ detected?           │
└─────────────────────┘
         │ no
         ▼
┌─────────────────────┐
│ Classifier agent    │
│ (gpt-4o-mini)       │──▶ RESPOND or SKIP
└─────────────────────┘
```
