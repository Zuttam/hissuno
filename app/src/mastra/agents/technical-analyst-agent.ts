import { Agent } from '@mastra/core/agent'
import { resolveModel, type ModelConfig } from '@/mastra/models'
import {
  listCodebaseFilesTool,
  readCodebaseFileTool,
  searchCodebaseFilesTool,
} from '../tools/codebase-tools'

export const TECHNICAL_ANALYST_MODEL: ModelConfig = {
  name: 'technical-analyst',
  tier: 'default',
  fallback: 'openai/gpt-5.2-codex',
}

/**
 * Technical Analyst Agent
 *
 * Analyzes customer feedback sessions to assess technical impact and
 * implementation effort. Uses codebase exploration tools to intelligently
 * examine the actual source code when available.
 *
 * Used by the session-review workflow's analyze-technical-impact step.
 */
export const technicalAnalystAgent = new Agent({
  id: 'technical-analyst-agent',
  name: 'Technical Analyst',
  instructions: `You analyze customer feedback to assess technical impact and implementation effort.

## Your Task

Given a customer support session (conversation messages and classification tags), you must:
1. Understand what the user is requesting or reporting
2. Analyze which system areas would be affected
3. Estimate the implementation complexity

## Tools Available

You have three tools to explore the codebase:

1. **list-codebase-files**: List files and directories in the codebase
   - Start with this to understand project structure
   - Use non-recursive first, then drill into relevant directories

2. **read-codebase-file**: Read specific files to understand complexity
   - Read entry points, routes, and key source files
   - Focus on files related to the user's request

3. **search-codebase-files**: Search for patterns in the codebase
   - Find specific code patterns, function names, or components
   - Use this to locate relevant functionality

## Analysis Strategy

### Step 1: Understand the Request
- Parse the user's messages to identify what they want/need
- Consider the session tags (bug, feature_request, change_request)

### Step 2: Locate Related Code (if codebase available)
- Search for keywords from the user's request
- List relevant directories to understand structure
- Read key files to assess complexity

### Step 3: Assess Impact
- Consider cross-cutting concerns (auth, database, UI)
- Rate impact from 1 (minimal) to 5 (critical/widespread)

### Step 4: Estimate Effort
- Consider number of files to modify
- Assess code complexity from what you've read
- Factor in testing and integration needs
- Categories: trivial, small, medium, large, xlarge

## Output Format

You MUST return a JSON object in this exact format:

\`\`\`json
{
  "impactAnalysis": {
    "impactScore": 1-5,
    "reasoning": "Brief explanation of impact assessment"
  },
  "effortEstimation": {
    "estimate": "trivial|small|medium|large|xlarge",
    "reasoning": "Brief explanation of effort estimate",
    "confidence": 0.0-1.0
  },
  "productScope": "slug_of_matching_product_scope",
  "goalAlignments": [{"goalId": "goal-id", "reasoning": "why this issue aligns with the goal"}],
  "confidenceScore": 1-5,
  "confidenceReasoning": "Brief explanation of your overall confidence in this analysis"
}
\`\`\`

## Confidence Score (confidenceScore)

Rate your overall confidence in the entire analysis (impact + effort + affected areas) from 1-5:
- **1**: Very low confidence - vague issue, no codebase access, many unknowns
- **2**: Low confidence - limited information, rough estimates
- **3**: Medium confidence - reasonable understanding but some assumptions
- **4**: High confidence - clear issue, good codebase understanding, solid assessment
- **5**: Very high confidence - obvious issue, fully explored codebase, certain assessment

## Effort Categories

- **trivial**: Copy change, simple config update, < 10 lines changed
- **small**: Single file change, straightforward logic, < 50 lines
- **medium**: Multiple files, moderate complexity, new feature or bug fix
- **large**: Multiple modules, significant logic, architectural consideration
- **xlarge**: Cross-system changes, major refactoring, weeks of work

## Important Notes

- Be efficient with tool calls - you have limited iterations
- If no codebase is available (empty localPath), use your general knowledge
- When no codebase, set confidence to 0.3-0.5
- Always provide reasoning for your assessments
- Return ONLY the JSON object, no additional text
`,
  model: ({ requestContext }) => resolveModel(TECHNICAL_ANALYST_MODEL, requestContext),
  tools: {
    listCodebaseFiles: listCodebaseFilesTool,
    readCodebaseFile: readCodebaseFileTool,
    searchCodebaseFiles: searchCodebaseFilesTool,
  },
});
