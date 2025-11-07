import { randomUUID } from 'crypto'
import type {
  AnalyzerRequest,
  AnalyzerResponse,
  AnalyzerResult,
  AnalyzerWarning,
} from '@/types/analyzer'
import {
  collectEntriesFromPath,
  collectEntriesFromZip,
  type AnalyzerFileEntry,
} from './collectors'
import { extractApiSurface, extractDesignSystem } from './extractors'

async function buildAnalyzerResponse(
  params: AnalyzerRequest,
  entries: AnalyzerFileEntry[],
  warnings: AnalyzerWarning[]
): Promise<AnalyzerResponse> {
  const designSystem = extractDesignSystem(entries, warnings)
  const apiEndpoints = extractApiSurface(entries, warnings)

  const result: AnalyzerResult = {
    designSystem,
    apiSurface: {
      endpoints: apiEndpoints,
    },
    stats: {
      fileCount: entries.length,
      componentCount: designSystem.components.length,
      apiCount: apiEndpoints.length,
    },
    warnings,
  }

  return {
    id: randomUUID(),
    requestedAt: new Date().toISOString(),
    prompt: params.prompt,
    source: params.source,
    result,
  }
}

export async function analyzeFromPath(
  directoryPath: string,
  prompt?: string
): Promise<AnalyzerResponse> {
  const { entries, warnings } = await collectEntriesFromPath(directoryPath)

  const request: AnalyzerRequest = {
    source: { kind: 'path', value: directoryPath },
    prompt,
  }

  return buildAnalyzerResponse(request, entries, warnings)
}

export async function analyzeFromZip(
  buffer: ArrayBuffer | Buffer,
  filename: string,
  prompt?: string
): Promise<AnalyzerResponse> {
  const { entries, warnings } = await collectEntriesFromZip(buffer, filename)

  const request: AnalyzerRequest = {
    source: { kind: 'upload', filename },
    prompt,
  }

  return buildAnalyzerResponse(request, entries, warnings)
}

export async function analyzeRequest(
  request: AnalyzerRequest,
  options: { zipBuffer?: ArrayBuffer | Buffer } = {}
): Promise<AnalyzerResponse> {
  if (request.source.kind === 'path') {
    return analyzeFromPath(request.source.value, request.prompt)
  }

  if (request.source.kind === 'upload') {
    if (!options.zipBuffer) {
      throw new Error('zipBuffer is required for upload analysis')
    }
    return analyzeFromZip(options.zipBuffer, request.source.filename, request.prompt)
  }

  throw new Error('Unsupported analysis source type')
}

