# Mastra Integration

This directory contains the Mastra agents and workflows for the Hissuno project.

## Weather Agent (Reference Example)

The weather agent serves as a reference implementation for Mastra integration. It demonstrates:
- Agent creation with custom instructions
- Tool integration
- Memory persistence with LibSQL
- Workflow orchestration

### Agent Structure

The weather agent (`src/mastra/agents/weather-agent.ts`) provides weather information and activity suggestions:

- **Model**: GPT-4o-mini
- **Tools**: Weather tool for fetching real-time weather data
- **Memory**: Persisted with LibSQL for conversation history

### Weather Workflow

The workflow (`src/mastra/workflows/weather-workflow.ts`) demonstrates a multi-step workflow:

1. **Fetch Weather** (`fetch-weather`)
   - Takes a city name as input
   - Fetches weather data from Open-Meteo API
   - Returns forecast data including temperature, precipitation, and conditions

2. **Plan Activities** (`plan-activities`)
   - Takes the weather forecast from step 1
   - Uses the weather agent to suggest activities based on conditions
   - Returns formatted activity suggestions

### Usage

The workflow can be executed through the Mastra instance:

```typescript
import { mastra } from '@/mastra'

const workflow = mastra.getWorkflow('weatherWorkflow')
const run = await workflow.createRunAsync({
  resourceId: userId,
})

const result = await run.start({
  inputData: {
    city: 'New York',
  },
})
```

### Testing

To test the weather workflow:

1. Start the Mastra development server:
   ```bash
   npm run dev:mastra
   ```

2. Use the Mastra playground to test the workflow

### Files

- **Agent**: `src/mastra/agents/weather-agent.ts`
- **Workflow**: `src/mastra/workflows/weather-workflow.ts`
- **Tool**: `src/mastra/tools/weather-tool.ts`
- **Registration**: `src/mastra/index.ts`
