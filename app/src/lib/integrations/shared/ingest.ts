/**
 * Ingestion primitives: the only surface a plugin uses to write data into Hissuno.
 *
 * Each function wraps an existing admin helper (sessions-service, customers-service,
 * issues-service, knowledge-service) and adds the bookkeeping needed for plugin
 * dedup via integration_synced_records.
 *
 * Plugins never call the admin helpers directly — they get a bound `ctx.ingest.*`
 * from the sync-runner that is scoped to a specific (connection, stream).
 */

import type {
  SessionIngestInput,
  ContactIngestInput,
  CompanyIngestInput,
  IssueIngestInput,
  KnowledgeIngestInput,
  Logger,
  StreamKind,
} from '../plugin-kit'
import { createSessionWithMessagesAdmin } from '@/lib/sessions/sessions-service'
import type { SessionSource } from '@/types/session'
import { upsertCompanyAdmin, upsertContactAdmin } from '@/lib/customers/customers-service'
import { createIssueAdmin } from '@/lib/issues/issues-service'
import { createKnowledgeSourceAdmin } from '@/lib/knowledge/knowledge-service'
import { recordSynced } from './synced-records'

export interface IngestBindings {
  projectId: string
  connectionId: string
  streamId: string
  logger: Logger
}

/**
 * Build a bound `ctx.ingest` object that automatically records every successful
 * ingestion in integration_synced_records.
 */
export function buildIngest(bindings: IngestBindings) {
  const { projectId, connectionId, streamId, logger } = bindings

  async function markSynced(kind: StreamKind, externalId: string, hissunoId: string) {
    try {
      await recordSynced({ connectionId, streamId, externalId, hissunoId, kind })
    } catch (err) {
      // Dedup table bookkeeping is best-effort — don't fail the sync on this.
      logger.warn('[ingest] failed to record synced record', {
        externalId,
        hissunoId,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return {
    session: async (input: SessionIngestInput): Promise<{ sessionId: string }> => {
      // Resolve a contact from email if requested and not already provided.
      let contactId = input.contactId
      if (!contactId && input.contactEmail) {
        const contact = await upsertContactAdmin({
          projectId,
          email: input.contactEmail,
          name: input.contactName,
          mergeStrategy: 'fill_nulls',
        })
        contactId = contact.record.id
      }

      const result = await createSessionWithMessagesAdmin({
        projectId,
        // SessionSource is a closed union; plugin authors must use one of the
        // values declared in SESSION_SOURCES (@/types/session). We keep the kit
        // type as `string` to avoid coupling plugin-kit to the session domain.
        source: input.source as SessionSource,
        sessionType: input.sessionType,
        status: input.status,
        name: input.name,
        description: input.description,
        userMetadata: input.userMetadata,
        firstMessageAt: input.firstMessageAt,
        lastActivityAt: input.lastActivityAt,
        createdAt: input.createdAt,
        messages: input.messages.map((m) => ({
          sender_type: m.senderType,
          content: m.content,
          created_at: m.createdAt,
        })),
        contactId,
      })

      if (!result) {
        throw new Error(`[ingest.session] failed to create session for externalId=${input.externalId}`)
      }

      await markSynced('sessions', input.externalId, result.sessionId)
      return { sessionId: result.sessionId }
    },

    contact: async (input: ContactIngestInput): Promise<{ contactId: string }> => {
      // Resolve company by domain if provided.
      let companyId = input.companyId ?? undefined
      if (!companyId && input.companyDomain) {
        const company = await upsertCompanyAdmin({
          projectId,
          domain: input.companyDomain,
          mergeStrategy: 'fill_nulls',
        })
        companyId = company.record.id
      }

      const result = await upsertContactAdmin({
        projectId,
        email: input.email,
        name: input.name,
        phone: input.phone,
        title: input.title,
        companyId,
        customFields: input.customFields,
        mergeStrategy: input.mergeStrategy ?? 'fill_nulls',
      })

      await markSynced('contacts', input.externalId, result.record.id)
      return { contactId: result.record.id }
    },

    company: async (input: CompanyIngestInput): Promise<{ companyId: string }> => {
      const result = await upsertCompanyAdmin({
        projectId,
        domain: input.domain,
        name: input.name,
        industry: input.industry,
        country: input.country,
        employeeCount: input.employeeCount,
        notes: input.notes,
        customFields: input.customFields,
        mergeStrategy: input.mergeStrategy ?? 'fill_nulls',
      })

      await markSynced('companies', input.externalId, result.record.id)
      return { companyId: result.record.id }
    },

    issue: async (input: IssueIngestInput): Promise<{ issueId: string }> => {
      const result = await createIssueAdmin({
        projectId,
        sessionId: input.sessionId,
        type: input.type,
        name: input.name,
        description: input.description,
        priority: input.priority,
        status: input.status,
        productScopeId: input.productScopeId,
        customFields: input.customFields,
      })

      await markSynced('issues', input.externalId, result.issue.id)
      return { issueId: result.issue.id }
    },

    knowledge: async (input: KnowledgeIngestInput): Promise<{ docId: string }> => {
      const source = await createKnowledgeSourceAdmin({
        projectId,
        type: input.type,
        name: input.name,
        description: input.description,
        url: input.url,
        content: input.content,
        storagePath: input.storagePath,
        notionPageId: input.notionPageId,
        analyzedContent: input.analyzedContent,
        sourceCodeId: input.sourceCodeId,
        analysisScope: input.analysisScope,
        origin: input.origin,
        customFields: input.customFields,
        parentId: input.parentId,
        enabled: input.enabled,
        productScopeId: input.productScopeId,
        skipInlineProcessing: input.skipInlineProcessing,
      })

      await markSynced('knowledge', input.externalId, source.id)
      return { docId: source.id }
    },
  }
}
