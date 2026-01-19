export {
  // Constants
  MAX_MESSAGE_LENGTH,
  VALID_TRIGGERS,
  VALID_DISPLAYS,
  VALID_POSITIONS,
  VALID_THEMES,
  // Types
  type ChatSSEEventType,
  type UpdateSSEEventType,
  type ValidatedChatSSEEvent,
  type ValidatedUpdateSSEEvent,
  type WidgetTrigger,
  type WidgetDisplay,
  type BubblePosition,
  type WidgetTheme,
  // Functions
  sanitizeText,
  validateMessageContent,
  validateChatSSEEvent,
  validateUpdateSSEEvent,
  sanitizePageUrl,
  validateTrigger,
  validateDisplay,
  validatePosition,
  validateTheme,
} from './validation';
