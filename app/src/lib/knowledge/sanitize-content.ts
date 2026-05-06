import { Agent } from '@mastra/core/agent'
import { RequestContext } from '@mastra/core/request-context'
import { resolveModel, type ModelConfig } from '@/mastra/models'

const SANITIZER_MODEL: ModelConfig = {
  name: 'security-scanner',
  tier: 'small',
  fallback: 'openai/gpt-5.4-mini',
}

const INSTRUCTIONS = `
You are a security specialist responsible for detecting and redacting sensitive information from documentation and knowledge content.

## Your Mission

Scan provided content for sensitive information and redact it with descriptive placeholders while preserving the usefulness of the documentation.

## Sensitive Information Categories

### 1. API Keys and Tokens
- AWS access keys (AKIA...)
- Google Cloud API keys
- GitHub tokens (ghp_, gho_, ghs_, ghr_)
- Stripe keys (sk_live_, pk_live_, sk_test_, pk_test_)
- OpenAI API keys (sk-...)
- Generic API keys and bearer tokens
- OAuth tokens and refresh tokens
- JWT tokens (eyJ...)

### 2. Credentials and Passwords
- Database connection strings with credentials
- Username/password combinations
- Basic auth headers
- SSH private keys
- PEM certificates and private keys
- RSA/DSA/ECDSA private keys

### 3. Environment Variables and Secrets
- Environment variable assignments with sensitive values
- .env file contents with secrets
- Kubernetes secrets
- Docker secrets

### 4. Infrastructure Details
- Internal IP addresses (10.x.x.x, 172.16-31.x.x, 192.168.x.x)
- Internal hostnames and domains
- Database hostnames and ports
- Internal service URLs

### 5. Personal Information
- Email addresses in code/configs (keep support emails, redact personal)
- Phone numbers in sensitive contexts
- Personal names associated with credentials

## Redaction Rules

Replace sensitive content with descriptive placeholders:

| Type | Placeholder |
|------|-------------|
| AWS Key | [REDACTED_AWS_KEY] |
| API Key | [REDACTED_API_KEY] |
| GitHub Token | [REDACTED_GITHUB_TOKEN] |
| Database URL | [REDACTED_DATABASE_URL] |
| Password | [REDACTED_PASSWORD] |
| Private Key | [REDACTED_PRIVATE_KEY] |
| Internal IP | [REDACTED_INTERNAL_IP] |
| Secret | [REDACTED_SECRET] |
| Token | [REDACTED_TOKEN] |
| Credential | [REDACTED_CREDENTIAL] |

## What NOT to Redact

- Example/placeholder values clearly marked as such (e.g., "your-api-key-here", "xxx")
- Public URLs and endpoints
- Public documentation references
- Support email addresses (support@, help@, info@)
- Generic code patterns without actual secrets
- Environment variable names (only redact the values)

## Output Format

- Do NOT include any introductory text, preambles, or explanations like "Here is the sanitized content..."
- Output ONLY the content itself with redactions applied — nothing before, nothing after

Return the content in the same structure, with:
1. All sensitive information replaced with appropriate placeholders
2. Preserve all formatting, headers, and structure
3. Keep the content useful for documentation purposes

## Important Guidelines

- Err on the side of caution - if unsure, redact
- Maintain the overall structure and readability
- Don't remove entire sections, just redact specific values
- Preserve code examples by replacing only the sensitive values
- Keep descriptions and explanations intact
`

const REDACTION_PATTERNS = [
  /\[REDACTED_AWS_KEY\]/g,
  /\[REDACTED_API_KEY\]/g,
  /\[REDACTED_GITHUB_TOKEN\]/g,
  /\[REDACTED_DATABASE_URL\]/g,
  /\[REDACTED_PASSWORD\]/g,
  /\[REDACTED_PRIVATE_KEY\]/g,
  /\[REDACTED_INTERNAL_IP\]/g,
  /\[REDACTED_SECRET\]/g,
  /\[REDACTED_TOKEN\]/g,
  /\[REDACTED_CREDENTIAL\]/g,
]

const PREAMBLE_PATTERNS = [
  /^(?:here(?:'s| is) (?:the )?(?:sanitized|redacted|cleaned)[\s\S]*?:\s*\n+)/i,
  /^(?:below is (?:the )?(?:sanitized|redacted|cleaned)[\s\S]*?:\s*\n+)/i,
  /^(?:i'?ve (?:sanitized|redacted|cleaned)[\s\S]*?:\s*\n+)/i,
]

function stripPreamble(text: string): string {
  let out = text
  for (const pattern of PREAMBLE_PATTERNS) {
    out = out.replace(pattern, '')
  }
  return out.trim()
}

function countRedactions(content: string): number {
  let count = 0
  for (const pattern of REDACTION_PATTERNS) {
    const matches = content.match(pattern)
    if (matches) count += matches.length
  }
  return count
}

export interface SanitizeContentResult {
  sanitized: string
  redactions: number
  changed: boolean
}

export async function sanitizeContent(
  content: string,
  ctx?: { projectId?: string },
): Promise<SanitizeContentResult> {
  if (!content) {
    return { sanitized: '', redactions: 0, changed: false }
  }

  const agent = new Agent({
    id: 'security-scanner',
    name: 'Security Scanner',
    instructions: INSTRUCTIONS,
    model: ({ requestContext }) => resolveModel(SANITIZER_MODEL, requestContext),
  })

  const prompt = `Scan the following knowledge content for sensitive information and redact any secrets, credentials, API keys, or other sensitive data you find. Return the content with all sensitive information replaced by appropriate placeholders.

---
CONTENT TO SCAN:
${content.slice(0, 50000)}
---

Return the sanitized content maintaining the exact same structure and formatting. Only replace sensitive values with redaction placeholders.`

  const requestContext = new RequestContext()
  if (ctx?.projectId) requestContext.set('projectId', ctx.projectId)

  const response = await agent.generate([{ role: 'user', content: prompt }], { requestContext })

  const sanitized = stripPreamble(response.text ?? '') || content
  const redactions = countRedactions(sanitized)
  return {
    sanitized,
    redactions,
    changed: sanitized !== content,
  }
}
