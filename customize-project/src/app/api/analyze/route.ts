import { NextResponse } from 'next/server'
import { analyzeFromPath, analyzeFromZip } from '@/lib/analyzer'
import { stageUploadFile } from '@/lib/analyzer/uploads'
import type { AnalyzerHistoryItem } from '@/types/analyzer'

export const runtime = 'nodejs'

const MAX_HISTORY = 10
const recentHistory: AnalyzerHistoryItem[] = []

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const promptInput = formData.get('prompt')
    const pathInput = formData.get('path')
    const fileInput = formData.get('upload')

    const prompt = typeof promptInput === 'string' ? promptInput.trim() || undefined : undefined
    const path = typeof pathInput === 'string' ? pathInput.trim() : undefined
    const file = fileInput instanceof File ? fileInput : undefined

    if (!path && !file) {
      return NextResponse.json(
        {
          error: 'Provide a directory path or upload a .zip archive to analyze.',
        },
        { status: 400 }
      )
    }

    let analysis
    let staged

    if (file) {
      if (!file.name.endsWith('.zip')) {
        return NextResponse.json(
          { error: 'Only .zip archives are supported for uploads right now.' },
          { status: 400 }
        )
      }

      staged = await stageUploadFile(file)
      try {
        analysis = await analyzeFromZip(staged.buffer, staged.filename, prompt)
      } finally {
        await staged.cleanup()
      }
    } else if (path) {
      analysis = await analyzeFromPath(path, prompt)
    }

    if (!analysis) {
      return NextResponse.json(
        { error: 'Unable to perform analysis. Provide a valid source.' },
        { status: 400 }
      )
    }

    recentHistory.unshift({
      id: analysis.id,
      prompt: analysis.prompt,
      source: analysis.source,
      requestedAt: analysis.requestedAt,
    })

    if (recentHistory.length > MAX_HISTORY) {
      recentHistory.length = MAX_HISTORY
    }

    return NextResponse.json({ analysis, history: recentHistory })
  } catch (error) {
    console.error('[analyze] error', error)
    return NextResponse.json(
      {
        error: 'Something went wrong while analyzing the project.',
      },
      { status: 500 }
    )
  }
}

