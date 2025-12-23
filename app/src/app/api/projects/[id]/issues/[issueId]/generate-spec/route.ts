import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { mastra } from '@/mastra'

export const runtime = 'nodejs'

interface RouteParams {
  params: Promise<{ id: string; issueId: string }>
}

/**
 * POST /api/projects/[id]/issues/[issueId]/generate-spec
 * Manually triggers product spec generation for an issue.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  if (!isSupabaseConfigured()) {
    console.error('[issues.generate-spec] Supabase must be configured')
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const { id: projectId, issueId } = await params

    const supabase = createAdminClient()

    // Verify issue exists and belongs to this project
    const { data: issue, error: issueError } = await supabase
      .from('issues')
      .select('id, title, project_id')
      .eq('id', issueId)
      .eq('project_id', projectId)
      .single()

    if (issueError || !issue) {
      return NextResponse.json({ error: 'Issue not found.' }, { status: 404 })
    }

    // Get PM agent
    const pmAgent = mastra.getAgent('productManagerAgent')

    if (!pmAgent) {
      return NextResponse.json({ error: 'Product Manager agent not found.' }, { status: 500 })
    }

    // Create runtime context
    const { RuntimeContext } = await import('@mastra/core/runtime-context')
    const runtimeContext = new RuntimeContext()
    runtimeContext.set('projectId', projectId)

    // Ask agent to generate spec
    const prompt = `Generate a product specification for issue ${issueId}.

1. Use generate-product-spec to gather all context (issue details, linked sessions, project knowledge)
2. Based on the context, generate a comprehensive product specification following the spec template
3. Use save-product-spec to store the generated specification

The spec should be detailed enough for an engineer to understand the scope and requirements.`

    const response = await pmAgent.generate(prompt, {
      runtimeContext,
    })

    // Check if spec was saved by parsing response text
    const responseText = typeof response.text === 'string' ? response.text.toLowerCase() : ''
    const specSaved = responseText.includes('spec') && 
      (responseText.includes('saved') || responseText.includes('generated') || responseText.includes('success'))

    if (specSaved) {
      // Get the updated issue with the spec
      const { data: updatedIssue } = await supabase
        .from('issues')
        .select('product_spec, product_spec_generated_at')
        .eq('id', issueId)
        .single()

      return NextResponse.json({
        success: true,
        spec: updatedIssue?.product_spec,
        generatedAt: updatedIssue?.product_spec_generated_at,
      })
    }

    return NextResponse.json({
      success: false,
      error: 'Failed to generate product specification',
    })
  } catch (error) {
    console.error('[issues.generate-spec] unexpected error', error)
    return NextResponse.json({ error: 'Unable to generate spec.' }, { status: 500 })
  }
}
