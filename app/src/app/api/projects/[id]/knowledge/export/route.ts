import { NextResponse } from 'next/server'
import JSZip from 'jszip'
import { assertUserOwnsProject } from '@/lib/auth/authorization'
import { UnauthorizedError } from '@/lib/auth/server'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { downloadKnowledgePackage } from '@/lib/knowledge/storage'

export const runtime = 'nodejs'

type RouteParams = { id: string }
type RouteContext = { params: Promise<RouteParams> }

/**
 * GET /api/projects/[id]/knowledge/export
 * Export all knowledge packages as a ZIP file containing markdown files
 */
export async function GET(request: Request, context: RouteContext) {
  const { id: projectId } = await context.params

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      throw new UnauthorizedError('User not authenticated')
    }

    await assertUserOwnsProject(supabase, user.id, projectId)

    // Fetch project name for ZIP naming
    const { data: project } = await supabase
      .from('projects')
      .select('name')
      .eq('id', projectId)
      .single()

    // Fetch all knowledge packages
    const { data: packages, error: packagesError } = await supabase
      .from('knowledge_packages')
      .select('*')
      .eq('project_id', projectId)
      .order('category', { ascending: true })

    if (packagesError) {
      console.error('[knowledge.export] Failed to fetch packages:', packagesError)
      return NextResponse.json({ error: 'Failed to fetch knowledge packages.' }, { status: 500 })
    }

    if (!packages || packages.length === 0) {
      return NextResponse.json({ error: 'No knowledge packages found.' }, { status: 404 })
    }

    // Create ZIP file
    const zip = new JSZip()
    const projectName = (project?.name ?? 'project').replace(/[^a-zA-Z0-9-_]/g, '-')
    const dateStr = new Date().toISOString().split('T')[0]
    const folderName = `knowledge-export-${projectName}-${dateStr}`
    const folder = zip.folder(folderName)!

    // Download and add each package to ZIP
    for (const pkg of packages) {
      const { content, error: downloadError } = await downloadKnowledgePackage(
        pkg.storage_path,
        supabase
      )

      if (downloadError || !content) {
        console.error(`[knowledge.export] Failed to download ${pkg.category}:`, downloadError)
        continue
      }

      // Create YAML frontmatter
      const frontmatter = [
        '---',
        `category: ${pkg.category}`,
        `version: ${pkg.version}`,
        `project: "${project?.name ?? 'Unknown'}"`,
        `exported_at: ${new Date().toISOString()}`,
        `generated_at: ${pkg.generated_at}`,
        '---',
        '',
      ].join('\n')

      const filename = `${pkg.category}-knowledge.md`
      folder.file(filename, frontmatter + content)
    }

    // Generate ZIP as blob
    const zipBlob = await zip.generateAsync({ type: 'blob' })
    const zipFilename = `${folderName}.zip`

    // Return as downloadable file
    return new NextResponse(zipBlob, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${zipFilename}"`,
      },
    })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }

    console.error('[knowledge.export] Unexpected error:', error)
    return NextResponse.json({ error: 'Failed to export knowledge.' }, { status: 500 })
  }
}
