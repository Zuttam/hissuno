
import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';
import { PostgresStore } from '@mastra/pg';
import { packageCompilationWorkflow } from './workflows/package-compilation';
import { issueAnalysisWorkflow } from './workflows/issue-analysis';
import { supportAgent } from './agents/support-agent';
import { codebaseAnalyzerAgent } from './agents/codebase-analyzer-agent';
import { webScraperAgent } from './agents/web-scraper-agent';
import { productManagerAgent } from './agents/product-manager-agent';
import { briefWriterAgent } from './agents/brief-writer-agent';
import { securityScannerAgent } from './agents/security-scanner-agent';
import { taggingAgent } from './agents/tagging-agent';
import { technicalAnalystAgent } from './agents/technical-analyst-agent';
import { responseClassifierAgent } from './agents/response-classifier-agent';

// Cache only the PostgresStore to prevent duplicate DB connections during Next.js HMR
// Mastra instance itself is recreated on each reload so config changes (new agents, etc.) take effect
const globalForMastra = globalThis as unknown as {
  mastraStorage: PostgresStore | undefined;
};

const storage =
  globalForMastra.mastraStorage ??
  new PostgresStore({
    connectionString: process.env.DATABASE_URL!,
    // optional but recommended: keep Mastra in its own schema
    schemaName: 'mastra', // Mastra will create mastra_* tables in this schema
  });

if (process.env.NODE_ENV !== 'production') {
  globalForMastra.mastraStorage = storage;
}

export const mastra = new Mastra({
  workflows: { packageCompilationWorkflow, issueAnalysisWorkflow },
  agents: {
    supportAgent,
    codebaseAnalyzerAgent,
    webScraperAgent,
    productManagerAgent,
    briefWriterAgent,
    securityScannerAgent,
    taggingAgent,
    technicalAnalystAgent,
    responseClassifierAgent,
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
