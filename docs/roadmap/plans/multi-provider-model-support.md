# Multi-Provider AI Model Support

All 10 Mastra agents are hardcoded to OpenAI models. This adds env var-based provider/model configuration with per-agent overrides and tier-based fallbacks, so operators can switch to Anthropic, Google, or any Mastra-supported provider without code changes.

**After**: Any Mastra-supported provider works via env vars. CLI setup prompts for provider choice. Zero-config defaults preserve current OpenAI behavior.

---

## Current State

All agents use hardcoded `openai/*` model strings:

| Agent | Current Model | Tier |
|-------|--------------|------|
| support-agent | `openai/gpt-5` | default |
| product-manager-agent | `openai/gpt-5` | default |
| web-scraper-agent | `openai/gpt-5` | default |
| feedback-decision-agent | `openai/gpt-5.2` | default |
| brief-writer-agent | `openai/gpt-5.2` | default |
| codebase-analyzer-agent | `openai/gpt-5.2` | default |
| technical-analyst-agent | `openai/gpt-5.2-codex` | default |
| tagging-agent | `openai/gpt-5.4-mini` | small |
| security-scanner-agent | `openai/gpt-5.4-mini` | small |
| response-classifier-agent | `openai/gpt-5.4-mini` | small |

No provider abstraction exists. CLI setup only prompts for OpenAI API key.

---

## Env Var Design

Resolution order: per-agent env var > tier default > hardcoded fallback.

| Env Var | Purpose | Default |
|---------|---------|---------|
| `AI_MODEL` | Default for heavy agents | `openai/gpt-5` |
| `AI_MODEL_SMALL` | Default for lightweight agents | `openai/gpt-5.4-mini` |
| `AI_MODEL_<AGENT>` | Per-agent override (e.g. `AI_MODEL_SUPPORT`) | - |

Per-agent env var suffixes: `SUPPORT`, `PRODUCT_MANAGER`, `WEB_SCRAPER`, `FEEDBACK_DECISION`, `BRIEF_WRITER`, `CODEBASE_ANALYZER`, `TECHNICAL_ANALYST`, `TAGGING`, `SECURITY_SCANNER`, `RESPONSE_CLASSIFIER`.

Mastra auto-reads provider API keys (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY`) based on the model string prefix.

---

## Phase 1: Central Model Config

New file: `app/src/mastra/models.ts`

- `resolveModel(agentName)` function implementing the env var cascade
- Maps each agent to a tier (`default` or `small`)
- Checks `AI_MODEL_<SUFFIX>` first, then `AI_MODEL`/`AI_MODEL_SMALL`, then hardcoded fallback

---

## Phase 2: Update Agent Files

Replace hardcoded `model: 'openai/...'` in all 10 agent files with `model: resolveModel('<agent-name>')`.

---

## Phase 3: Update CLI Setup

File: `app/packages/cli/src/commands/setup/configure-env.ts`

- Replace OpenAI-only confirm/password flow with provider selection (OpenAI, Anthropic, Google, Skip)
- Prompt for the appropriate API key based on provider
- Write `AI_MODEL` and `AI_MODEL_SMALL` for non-OpenAI providers
- Provider defaults:
  - OpenAI: `openai/gpt-5` / `openai/gpt-5.4-mini`
  - Anthropic: `anthropic/claude-4-5-sonnet` / `anthropic/claude-haiku-4-5`
  - Google: `google/gemini-2.5-pro` / `google/gemini-2.5-flash`

---

## Out of Scope

- Embeddings (`app/src/lib/embeddings/shared.ts`) - stays OpenAI `text-embedding-3-small`
- No new packages - Mastra natively supports `provider/model-name` strings

---

## New Files (1)

| File | Phase |
|------|-------|
| `app/src/mastra/models.ts` | 1 |

## Modified Files (11)

| File | Phase | Change |
|------|-------|--------|
| `app/src/mastra/agents/support-agent.ts` | 2 | Use `resolveModel('support')` |
| `app/src/mastra/agents/product-manager-agent.ts` | 2 | Use `resolveModel('product-manager')` |
| `app/src/mastra/agents/web-scraper-agent.ts` | 2 | Use `resolveModel('web-scraper')` |
| `app/src/mastra/agents/feedback-decision-agent.ts` | 2 | Use `resolveModel('feedback-decision')` |
| `app/src/mastra/agents/brief-writer-agent.ts` | 2 | Use `resolveModel('brief-writer')` |
| `app/src/mastra/agents/codebase-analyzer-agent.ts` | 2 | Use `resolveModel('codebase-analyzer')` |
| `app/src/mastra/agents/technical-analyst-agent.ts` | 2 | Use `resolveModel('technical-analyst')` |
| `app/src/mastra/agents/tagging-agent.ts` | 2 | Use `resolveModel('tagging')` |
| `app/src/mastra/agents/security-scanner-agent.ts` | 2 | Use `resolveModel('security-scanner')` |
| `app/src/mastra/agents/response-classifier-agent.ts` | 2 | Use `resolveModel('response-classifier')` |
| `app/packages/cli/src/commands/setup/configure-env.ts` | 3 | Provider selection + model env vars |

## Verification

1. Zero-config backward compat: no env vars set, all agents resolve to current OpenAI models
2. Tier override: set `AI_MODEL=anthropic/claude-4-5-sonnet` + `AI_MODEL_SMALL=anthropic/claude-haiku-4-5`, verify all agents switch
3. Per-agent override: set `AI_MODEL_SUPPORT=anthropic/claude-4-5-sonnet` while leaving others on OpenAI
4. CLI: run `hissuno setup`, select each provider, verify correct env vars in `.env.local`
5. TypeScript: `npx tsc --noEmit` passes
