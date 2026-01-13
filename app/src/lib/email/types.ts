export interface WelcomeEmailData {
  userId: string
  email: string
  fullName?: string | null
}

export interface SendEmailResult {
  success: boolean
  messageId?: string
  error?: string
}
