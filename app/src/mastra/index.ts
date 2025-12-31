
import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';
import { PostgresStore } from '@mastra/pg';
import { knowledgeAnalysisWorkflow } from './workflows/knowledge-analysis';
import { supportAgent } from './agents/support-agent';
import { codebaseAnalyzerAgent } from './agents/codebase-analyzer-agent';
import { webScraperAgent } from './agents/web-scraper-agent';
import { knowledgeCompilerAgent } from './agents/knowledge-compiler-agent';
import { productManagerAgent } from './agents/product-manager-agent';
import { securityScannerAgent } from './agents/security-scanner-agent';

const storage = new PostgresStore({
  connectionString: process.env.DATABASE_URL!,
  // optional but recommended: keep Mastra in its own schema
  schemaName: 'mastra', // Mastra will create mastra_* tables in this schema
});

export const mastra = new Mastra({
  workflows: { knowledgeAnalysisWorkflow },
  agents: {
    supportAgent,
    codebaseAnalyzerAgent,
    webScraperAgent,
    knowledgeCompilerAgent,
    productManagerAgent,
    securityScannerAgent,
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
