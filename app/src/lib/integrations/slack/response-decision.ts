/**
 * Response Decision Service
 * Determines if the bot should respond to messages in subscribed threads
 * Uses heuristics-first approach with classifier agent fallback for ambiguous cases
 */

import { db } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { sessions } from '@/lib/db/schema/app'
import type { SlackMessage } from './client'
import { classifyShouldRespond } from './response-classifier'

const LOG_PREFIX = '[slack.response-decision]'

/**
 * Human takeover phrases that signal the bot should stop responding
 */
const HUMAN_TAKEOVER_PHRASES = [
  "i'll handle this",
  "i will handle this",
  "let me handle this",
  "let me take over",
  "i'll take over",
  "i will take over",
  "i've got this",
  "i got this",
  "i'll respond",
  "i will respond",
  "let me respond",
  "i'll take it from here",
  "i will take it from here",
  "human here",
  "taking over",
  "i'll help",
  "i will help",
  'thanks hissuno',
  'thank you hissuno',
  'got it from here',
]

export type ResponseDecision = {
  shouldRespond: boolean
  confidence: 'high' | 'medium' | 'low'
  reason: string
  usedClassifier: boolean
}

export type DecideIfShouldRespondParams = {
  text: string
  botUserId: string
  lastResponderType: 'bot' | 'user' | null
  threadHistory?: SlackMessage[]
  sessionId?: string
}

/**
 * Check if text contains a direct mention of a user
 */
function containsMention(text: string, userId: string): boolean {
  return text.includes(`<@${userId}>`)
}

/**
 * Check if text contains any user mention (excluding the bot)
 */
function containsOtherMention(text: string, botUserId: string): boolean {
  const mentionPattern = /<@([A-Z0-9]+)>/g
  let match: RegExpExecArray | null
  while ((match = mentionPattern.exec(text)) !== null) {
    if (match[1] !== botUserId) {
      return true
    }
  }
  return false
}

/**
 * Check if text contains human takeover phrases
 */
function containsHumanTakeoverPhrase(text: string): boolean {
  const normalizedText = text.toLowerCase()
  return HUMAN_TAKEOVER_PHRASES.some((phrase) => normalizedText.includes(phrase))
}

async function classifyMessage(
  text: string,
  threadHistory?: SlackMessage[]
): Promise<{ shouldRespond: boolean; reason: string }> {
  try {
    return await classifyShouldRespond({ text, threadHistory })
  } catch (error) {
    console.error(`${LOG_PREFIX} Classifier error:`, error)
    return { shouldRespond: true, reason: 'Classifier error, defaulting to respond' }
  }
}

/**
 * Decide if the bot should respond to a message in a subscribed thread
 *
 * Decision flow:
 * 0. Session in human takeover mode -> SKIP
 * 1. Bot directly mentioned -> RESPOND
 * 2. Another user mentioned -> SKIP
 * 3. Human takeover phrase detected -> SKIP
 * 4. Bot was last responder -> RESPOND (continuation of conversation)
 * 5. Uncertain -> Call classifier agent
 */
export async function decideIfShouldRespond(
  params: DecideIfShouldRespondParams
): Promise<ResponseDecision> {
  const { text, botUserId, lastResponderType, threadHistory, sessionId } = params

  // 0. Session in human takeover mode - never respond
  if (sessionId) {
    const sessionRows = await db
      .select({ is_human_takeover: sessions.is_human_takeover })
      .from(sessions)
      .where(eq(sessions.id, sessionId))

    const session = sessionRows[0]

    if (session?.is_human_takeover) {
      return {
        shouldRespond: false,
        confidence: 'high',
        reason: 'Session is in human takeover mode',
        usedClassifier: false,
      }
    }
  }

  // 1. Bot directly mentioned - always respond
  if (containsMention(text, botUserId)) {
    return {
      shouldRespond: true,
      confidence: 'high',
      reason: 'Bot directly mentioned',
      usedClassifier: false,
    }
  }

  // 2. Another user mentioned - likely directed at them, skip
  if (containsOtherMention(text, botUserId)) {
    return {
      shouldRespond: false,
      confidence: 'high',
      reason: 'Message mentions another user',
      usedClassifier: false,
    }
  }

  // 3. Human takeover phrase detected - stop responding
  if (containsHumanTakeoverPhrase(text)) {
    return {
      shouldRespond: false,
      confidence: 'high',
      reason: 'Human takeover phrase detected',
      usedClassifier: false,
    }
  }

  // 4. Bot was last responder - continue the conversation
  if (lastResponderType === 'bot') {
    return {
      shouldRespond: true,
      confidence: 'medium',
      reason: 'Continuing conversation (bot was last responder)',
      usedClassifier: false,
    }
  }

  // 5. Uncertain - use classifier agent
  console.log(`${LOG_PREFIX} Using classifier for ambiguous message`)
  const classification = await classifyMessage(text, threadHistory)

  return {
    shouldRespond: classification.shouldRespond,
    confidence: 'low',
    reason: classification.reason,
    usedClassifier: true,
  }
}
