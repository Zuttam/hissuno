
import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';
import { PostgresStore } from '@mastra/pg';
import { knowledgeAnalysisWorkflow } from './workflows/knowledge-analysis';
import { sessionReviewWorkflow } from './workflows/session-review';
import { supportAgent } from './agents/support-agent';
import { codebaseAnalyzerAgent } from './agents/codebase-analyzer-agent';
import { webScraperAgent } from './agents/web-scraper-agent';
import { knowledgeCompilerAgent } from './agents/knowledge-compiler-agent';
import { productManagerAgent } from './agents/product-manager-agent';
import { specWriterAgent } from './agents/spec-writer-agent';
import { securityScannerAgent } from './agents/security-scanner-agent';
import { taggingAgent } from './agents/tagging-agent';

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
  workflows: { knowledgeAnalysisWorkflow, sessionReviewWorkflow },
  agents: {
    supportAgent,
    codebaseAnalyzerAgent,
    webScraperAgent,
    knowledgeCompilerAgent,
    productManagerAgent,
    specWriterAgent,
    securityScannerAgent,
    taggingAgent,
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
