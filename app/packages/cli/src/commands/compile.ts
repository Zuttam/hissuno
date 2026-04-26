/**
 * hissuno compile <type> <id> - Run a deterministic compilation operation
 *
 * Currently supports `package`: re-analyzes each linked knowledge source then
 * organizes the embedded chunks into a structured support package
 * (FAQ / how-to / feature-docs / troubleshooting).
 *
 * Used by the `hissuno-support-wiki` skill, but also runnable directly from
 * a developer shell when iterating on a package.
 */

import { Command } from 'commander'
import { requireConfig } from '../lib/config.js'
import { apiCall, resolveProjectId, buildPath } from '../lib/api.js'
import { renderJson, success, error } from '../lib/output.js'

interface CompilePackageResult {
  packageId: string
  sourcesProcessed: number
  analyzeErrors: { sourceId: string; message: string }[]
  compiled: boolean
  compilationError: string | null
  compiledAt: string | null
}

export const compileCommand = new Command('compile')
  .description('Run a compilation operation against a hissuno resource')
  .argument('<type>', 'Resource type. Supported: package')
  .argument('<id>', 'Resource ID')
  .option('--source-ids <ids>', 'Comma-separated source IDs to limit compile to')
  .option('--skip-analyze', 'Skip per-source re-analyze; assume sources are up-to-date', false)
  .action(async (type, id, opts, cmd) => {
    if (type !== 'package' && type !== 'packages') {
      error(`Invalid type "${type}". Supported: package`)
      process.exit(1)
    }

    const config = requireConfig()
    const jsonMode = cmd.parent?.opts().json
    const projectId = await resolveProjectId(config)

    const body: Record<string, unknown> = {}
    if (opts.skipAnalyze) body.skipAnalyze = true
    if (typeof opts.sourceIds === 'string' && opts.sourceIds.length > 0) {
      body.sourceIds = opts.sourceIds.split(',').map((s: string) => s.trim()).filter(Boolean)
    }

    console.log(`Compiling package ${id}...`)
    const result = await apiCall<CompilePackageResult>(
      config,
      'POST',
      buildPath(`/api/knowledge/packages/${id}/compile`, { projectId }),
      body,
    )

    if (!result.ok) {
      const data = result.data as { error?: string }
      error(`Failed: ${data.error ?? `HTTP ${result.status}`}`)
      process.exit(1)
    }

    if (jsonMode) {
      console.log(renderJson(result.data))
      return
    }

    const data = result.data
    success(`Compiled package ${data.packageId}`)
    console.log(`  Sources processed: ${data.sourcesProcessed}`)
    if (data.analyzeErrors.length > 0) {
      console.log(`  Analyze errors:`)
      for (const e of data.analyzeErrors) {
        console.log(`    - ${e.sourceId}: ${e.message}`)
      }
    }
    if (data.compilationError) {
      console.log(`  Compilation error: ${data.compilationError}`)
      process.exit(2)
    }
    console.log(`  Compiled at: ${data.compiledAt ?? 'unknown'}`)
  })
