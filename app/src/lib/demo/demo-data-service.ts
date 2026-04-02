/**
 * Demo Data Service
 *
 * Creates a rich set of demo data across all entities for demo projects.
 * Used during onboarding when a user chooses the "Demo Project" option.
 */

import { randomUUID } from 'crypto'
import { db } from '@/lib/db'
import {
  sessions as sessionsTable,
  sessionMessages,
  issues as issuesTable,
  productScopes,
  knowledgeSources,
  contacts,
  companies,
} from '@/lib/db/schema/app'
import { eq, and } from 'drizzle-orm'
import { createIssueAdmin } from '@/lib/issues/issues-service'
import { insertCompany } from '@/lib/db/queries/companies'
import { insertContact } from '@/lib/db/queries/contacts'
import { fireGraphEval } from '@/lib/utils/graph-eval'
import {
  setSessionContact,
  setEntityProductScope,
  linkEntities,
} from '@/lib/db/queries/entity-relationships'
import { batchEmbedIssues } from '@/lib/issues/embedding-service'
import { batchEmbedSessions } from '@/lib/sessions/embedding-service'
import { batchEmbedContacts } from '@/lib/customers/customer-embedding-service'
import { embedKnowledgeSource } from '@/lib/knowledge/embedding-service'
import { batchEmbedProductScopes } from '@/lib/product-scopes/embedding-service'

import { DEMO_PRODUCT_SCOPES } from './demo-data/product-scopes'
import { DEMO_KNOWLEDGE_SOURCES } from './demo-data/knowledge-sources'
import { DEMO_COMPANIES } from './demo-data/companies'
import { DEMO_CONTACTS } from './demo-data/contacts'
import { DEMO_SESSIONS } from './demo-data/sessions'

// ============================================================================
// Main Service Function
// ============================================================================

export async function createDemoProjectData({
  projectId,
}: {
  projectId: string
}): Promise<{
  sessionsCreated: number
  issuesCreated: number
  companiesCreated: number
  contactsCreated: number
  productScopesCreated: number
  knowledgeSourcesCreated: number
}> {
  let sessionsCreated = 0
  let issuesCreated = 0
  let companiesCreated = 0
  let contactsCreated = 0
  let productScopesCreated = 0
  let knowledgeSourcesCreated = 0

  // 1. Create product scopes
  const productScopeIds: string[] = []
  for (const pa of DEMO_PRODUCT_SCOPES) {
    try {
      const [created] = await db
        .insert(productScopes)
        .values({
          project_id: projectId,
          name: pa.name,
          slug: pa.slug,
          description: pa.description,
          color: pa.color,
          position: pa.position,
          is_default: pa.isDefault,
          type: pa.type,
          goals: pa.goals,
        })
        .returning({ id: productScopes.id })

      productScopeIds.push(created!.id)
      productScopesCreated++
    } catch (err) {
      console.error('[demo-data-service] failed to create product scope:', pa.name, err)
      productScopeIds.push('')
    }
  }

  // 2. Create companies
  const companyIds: string[] = []
  for (const company of DEMO_COMPANIES) {
    try {
      const created = await insertCompany({
        projectId,
        name: company.name,
        domain: company.domain,
        stage: company.stage,
        industry: company.industry,
        arr: company.arr,
        planTier: company.planTier,
        employeeCount: company.employeeCount,
        country: company.country,
        healthScore: company.healthScore,
      })
      companyIds.push(created.id)
      fireGraphEval(projectId, 'company', created.id)
      companiesCreated++
    } catch (err) {
      console.error('[demo-data-service] failed to create company:', company.name, err)
      companyIds.push('')
    }
  }

  // 3. Create contacts (linked to companies)
  const contactIds: string[] = []
  for (const contact of DEMO_CONTACTS) {
    try {
      const companyId = companyIds[contact.companyIndex] || null
      const created = await insertContact({
        projectId,
        name: contact.name,
        email: contact.email,
        companyId,
        role: contact.role,
        title: contact.title,
        isChampion: contact.isChampion,
      })
      contactIds.push(created.id)
      fireGraphEval(projectId, 'contact', created.id)
      contactsCreated++
    } catch (err) {
      console.error('[demo-data-service] failed to create contact:', contact.name, err)
      contactIds.push('')
    }
  }

  // 4. Create knowledge sources (after companies so we can link customer-specific docs)
  for (const ks of DEMO_KNOWLEDGE_SOURCES) {
    try {
      const [created] = await db
        .insert(knowledgeSources)
        .values({
          project_id: projectId,
          name: ks.name,
          description: ks.description,
          type: 'raw_text',
          status: 'done',
          content: ks.content,
          analyzed_content: ks.content,
          analyzed_at: new Date(),
          enabled: true,
        })
        .returning({ id: knowledgeSources.id })

      knowledgeSourcesCreated++

      // Link knowledge source to product scope if specified
      if (ks.productScopeIndex !== null) {
        const paId = productScopeIds[ks.productScopeIndex]
        if (paId && created) {
          try {
            await setEntityProductScope(projectId, 'knowledge_source', created.id, paId)
          } catch (err) {
            console.error('[demo-data-service] failed to link knowledge source to product scope:', ks.name, err)
          }
        }
      }

      // Link knowledge source to company if specified
      if (ks.companyIndex != null && created) {
        const companyId = companyIds[ks.companyIndex]
        if (companyId) {
          try {
            await linkEntities(projectId, 'knowledge_source', created.id, 'company', companyId)
          } catch (err) {
            console.error('[demo-data-service] failed to link knowledge source to company:', ks.name, err)
          }
        }
      }
    } catch (err) {
      console.error('[demo-data-service] failed to create knowledge source:', ks.name, err)
    }
  }

  // 5. Create sessions, issues, and entity relationships
  for (const demo of DEMO_SESSIONS) {
    try {
      const sessionId = randomUUID()
      const now = new Date()
      const messageCount = demo.messages?.length ?? 0

      const [session] = await db
        .insert(sessionsTable)
        .values({
          id: sessionId,
          project_id: projectId,
          name: demo.name,
          description: demo.description,
          source: 'manual',
          session_type: 'chat',
          status: 'active',
          message_count: messageCount,
          tags: demo.tags ?? [],
          is_archived: false,
          first_message_at: messageCount > 0 ? now : null,
          last_activity_at: now,
        })
        .returning()

      if (!session) continue

      // Store messages
      if (demo.messages && demo.messages.length > 0) {
        for (const msg of demo.messages) {
          await db.insert(sessionMessages).values({
            session_id: sessionId,
            project_id: projectId,
            sender_type: msg.role === 'user' ? 'user' : 'ai',
            content: msg.content,
          })
        }
      }

      sessionsCreated++

      // Update session status if specified (non-issue sessions that should be closed)
      if (demo.status === 'closed' && !demo.issue) {
        await db
          .update(sessionsTable)
          .set({ status: 'closed' })
          .where(
            and(
              eq(sessionsTable.id, session.id),
              eq(sessionsTable.project_id, projectId)
            )
          )
      }

      // Link session to contact
      if (demo.contactIndex !== null) {
        const contactId = contactIds[demo.contactIndex]
        if (contactId) {
          try {
            await setSessionContact(projectId, session.id, contactId)
          } catch (err) {
            console.error('[demo-data-service] failed to link session to contact:', demo.name, err)
          }
        }
      }

      // Link session to product scope
      const paId = productScopeIds[demo.productScopeIndex]
      if (paId) {
        try {
          await setEntityProductScope(projectId, 'session', session.id, paId)
        } catch (err) {
          console.error('[demo-data-service] failed to link session to product scope:', demo.name, err)
        }
      }

      // Link session to company (via contact's company)
      if (demo.contactIndex !== null) {
        const contact = DEMO_CONTACTS[demo.contactIndex]
        if (contact) {
          const companyId = companyIds[contact.companyIndex]
          if (companyId) {
            try {
              await linkEntities(projectId, 'session', session.id, 'company', companyId)
            } catch (err) {
              console.error('[demo-data-service] failed to link session to company:', demo.name, err)
            }
          }
        }
      }

      // If this session has a linked issue, close the session and create the issue
      if (demo.issue) {
        // Mark session as closed
        await db
          .update(sessionsTable)
          .set({
            status: 'closed',
          })
          .where(
            and(
              eq(sessionsTable.id, session.id),
              eq(sessionsTable.project_id, projectId)
            )
          )

        // Create the linked issue with product scope
        try {
          const issuePaId = productScopeIds[demo.productScopeIndex] || undefined
          const { issue } = await createIssueAdmin({
            projectId,
            sessionId: session.id,
            type: demo.issue.type,
            name: demo.issue.name,
            description: demo.issue.description,
            priority: demo.issue.priority,
            productScopeId: issuePaId,
          })
          issuesCreated++

          // Update brief and RICE scores if defined
          const updates: Record<string, unknown> = {}
          if (demo.issue.brief) {
            updates.brief = demo.issue.brief
            updates.brief_generated_at = new Date()
          }
          if (demo.issue.reach != null) {
            updates.reach_score = demo.issue.reach
            if (demo.issue.reachReasoning) updates.reach_reasoning = demo.issue.reachReasoning
          }
          if (demo.issue.impact != null) {
            updates.impact_score = demo.issue.impact
            updates.impact_analysis = {
              impactScore: demo.issue.impact,
              reasoning: demo.issue.impactReasoning ?? `Impact score: ${demo.issue.impact}/5`,
              ...(demo.issue.goalAlignments?.length ? { goalAlignments: demo.issue.goalAlignments } : {}),
            }
          }
          if (demo.issue.confidence != null) {
            updates.confidence_score = demo.issue.confidence
            if (demo.issue.confidenceReasoning) updates.confidence_reasoning = demo.issue.confidenceReasoning
          }
          if (demo.issue.effort != null) {
            updates.effort_score = demo.issue.effort
            if (demo.issue.effortEstimate) updates.effort_estimate = demo.issue.effortEstimate
            if (demo.issue.effortReasoning) updates.effort_reasoning = demo.issue.effortReasoning
          }

          if (Object.keys(updates).length > 0) {
            await db
              .update(issuesTable)
              .set(updates)
              .where(
                and(
                  eq(issuesTable.id, issue.id),
                  eq(issuesTable.project_id, projectId)
                )
              )
          }
        } catch (err) {
          console.error('[demo-data-service] failed to create issue for:', demo.name, err)
        }
      }
    } catch (err) {
      console.error('[demo-data-service] failed to create demo session:', demo.name, err)
    }
  }

  console.log(
    '[demo-data-service] created demo data for project:',
    projectId,
    { sessionsCreated, issuesCreated, companiesCreated, contactsCreated, productScopesCreated, knowledgeSourcesCreated }
  )

  // Generate embeddings for all created entities (requires OPENAI_API_KEY)
  await generateDemoEmbeddings(projectId)

  return { sessionsCreated, issuesCreated, companiesCreated, contactsCreated, productScopesCreated, knowledgeSourcesCreated }
}

// ============================================================================
// Embedding Generation
// ============================================================================

async function generateDemoEmbeddings(projectId: string): Promise<void> {
  if (!process.env.OPENAI_API_KEY) {
    console.warn('[demo-data-service] OPENAI_API_KEY not set, skipping embedding generation. Text search fallback will still work.')
    return
  }

  console.log('[demo-data-service] generating embeddings for demo data...')

  try {
    // 1. Issues
    const issueRows = await db
      .select({
        id: issuesTable.id,
        project_id: issuesTable.project_id,
        name: issuesTable.name,
        description: issuesTable.description,
      })
      .from(issuesTable)
      .where(eq(issuesTable.project_id, projectId))

    if (issueRows.length > 0) {
      const issueResult = await batchEmbedIssues(
        issueRows.map((r) => ({
          id: r.id,
          project_id: r.project_id,
          name: r.name,
          description: r.description ?? '',
        }))
      )
      console.log(`[demo-data-service] embedded ${issueResult.embedded} issues`)
    }

    // 2. Sessions
    const sessionRows = await db
      .select({
        id: sessionsTable.id,
        project_id: sessionsTable.project_id,
        name: sessionsTable.name,
        description: sessionsTable.description,
      })
      .from(sessionsTable)
      .where(eq(sessionsTable.project_id, projectId))

    if (sessionRows.length > 0) {
      const sessionResult = await batchEmbedSessions(
        sessionRows.map((r) => ({
          id: r.id,
          project_id: r.project_id,
          name: r.name ?? '',
          description: r.description ?? '',
        }))
      )
      console.log(`[demo-data-service] embedded ${sessionResult.embedded} sessions`)
    }

    // 3. Contacts (with company name join)
    const contactRows = await db
      .select({
        id: contacts.id,
        project_id: contacts.project_id,
        name: contacts.name,
        email: contacts.email,
        role: contacts.role,
        title: contacts.title,
        companyName: companies.name,
      })
      .from(contacts)
      .leftJoin(companies, eq(contacts.company_id, companies.id))
      .where(eq(contacts.project_id, projectId))

    if (contactRows.length > 0) {
      const contactResult = await batchEmbedContacts(
        contactRows.map((r) => ({
          id: r.id,
          project_id: r.project_id,
          name: r.name,
          email: r.email,
          role: r.role,
          title: r.title,
          companyName: r.companyName,
        }))
      )
      console.log(`[demo-data-service] embedded ${contactResult.embedded} contacts`)
    }

    // 4. Knowledge sources
    const knowledgeRows = await db
      .select({
        id: knowledgeSources.id,
        project_id: knowledgeSources.project_id,
        analyzed_content: knowledgeSources.analyzed_content,
      })
      .from(knowledgeSources)
      .where(
        and(
          eq(knowledgeSources.project_id, projectId),
          eq(knowledgeSources.status, 'done')
        )
      )

    let knowledgeChunksEmbedded = 0
    for (const ks of knowledgeRows) {
      if (!ks.analyzed_content) continue
      const result = await embedKnowledgeSource({
        id: ks.id,
        project_id: ks.project_id,
        analyzed_content: ks.analyzed_content,
      })
      knowledgeChunksEmbedded += result.chunksEmbedded
    }
    if (knowledgeRows.length > 0) {
      console.log(`[demo-data-service] embedded ${knowledgeChunksEmbedded} knowledge chunks from ${knowledgeRows.length} sources`)
    }

    // 5. Product Scopes
    const productScopeRows = await db
      .select({
        id: productScopes.id,
        project_id: productScopes.project_id,
        name: productScopes.name,
        description: productScopes.description,
        type: productScopes.type,
        goals: productScopes.goals,
      })
      .from(productScopes)
      .where(eq(productScopes.project_id, projectId))

    if (productScopeRows.length > 0) {
      const scopeResult = await batchEmbedProductScopes(
        productScopeRows.map((r) => ({
          id: r.id,
          project_id: r.project_id,
          name: r.name,
          description: r.description ?? '',
          type: r.type,
          goals: r.goals as Array<{ id: string; text: string }> | null,
        }))
      )
      console.log(`[demo-data-service] embedded ${scopeResult.embedded} product scopes`)
    }
  } catch (err) {
    console.error('[demo-data-service] embedding generation failed (non-fatal):', err)
  }
}
