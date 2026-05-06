
import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';
import { PostgresStore } from '@mastra/pg';
import { supportAgent } from './agents/support-agent';
import { codebaseAnalyzerAgent } from './agents/codebase-analyzer-agent';
import { webScraperAgent } from './agents/web-scraper-agent';
import { productManagerAgent } from './agents/product-manager-agent';
import { securityScannerAgent } from './agents/security-scanner-agent';
import { taggingAgent } from './agents/tagging-agent';
import { responseClassifierAgent } from './agents/response-classifier-agent';

// Cache only the PostgresStore to prevent duplicate DB connections during Next.js HMR
// Mastra instance itself is recreated on each reload so config changes (new agents, etc.) take effect
const globalForMastra = globalThis as unknown as {
  mastraStorage: PostgresStore | undefined;
};

const storage =
  globalForMastra.mastraStorage ??
  new PostgresStore({
    id: 'mastra-pg',
    connectionString: process.env.DATABASE_URL!,
    // keep Mastra in its own schema; mastra_* tables are created here
    schemaName: 'mastra',
    // Defer table creation to deploy-time/init scripts. Otherwise every
    // build worker tries to create tables in parallel and exhausts pg pools.
    disableInit: true,
    max: 5,
  });

if (process.env.NODE_ENV !== 'production') {
  globalForMastra.mastraStorage = storage;
}

export const mastra = new Mastra({
  agents: {
    supportAgent,
    codebaseAnalyzerAgent,
    webScraperAgent,
    productManagerAgent,
    securityScannerAgent,
    taggingAgent,
    responseClassifierAgent,
  },
  storage,
  logger: new PinoLogger({
    name: 'Mastra',
    level: 'info',
  }),
});
