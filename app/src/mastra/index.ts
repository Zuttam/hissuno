
import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';
import { supportAgent, productManagerAgent } from './agents/chat-agent';
import { storage } from './storage';

export const mastra = new Mastra({
  agents: {
    supportAgent,
    productManagerAgent,
  },
  storage,
  logger: new PinoLogger({
    name: 'Mastra',
    level: 'info',
  }),
});
