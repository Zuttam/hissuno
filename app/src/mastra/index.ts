
import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';
import { PostgresStore } from '@mastra/pg';
import { weatherWorkflow } from './workflows/weather-workflow';
import { knowledgeAnalysisWorkflow } from './workflows/knowledge-analysis';
import { weatherAgent } from './agents/weather-agent';
import { supportAgent } from './agents/support-agent';
import { codebaseAnalyzerAgent } from './agents/codebase-analyzer-agent';
import { webScraperAgent } from './agents/web-scraper-agent';
import { knowledgeCompilerAgent } from './agents/knowledge-compiler-agent';

const storage = new PostgresStore({
  connectionString: process.env.DATABASE_URL!,
  // optional but recommended: keep Mastra in its own schema
  schemaName: 'mastra', // Mastra will create mastra_* tables in this schema
});

export const mastra = new Mastra({
  workflows: { weatherWorkflow, knowledgeAnalysisWorkflow },
  agents: {
    weatherAgent,
    supportAgent,
    codebaseAnalyzerAgent,
    webScraperAgent,
    knowledgeCompilerAgent,
  },
  storage,
  logger: new PinoLogger({
    name: 'Mastra',
    level: 'info',
  }),
  telemetry: { enabled: false },
  observability: {
    default: { enabled: false },
  },
});
