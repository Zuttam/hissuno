/**
 * GitHub → Hissuno codebase registration. Verifies the repo (and branch if
 * provided), then POSTs to /api/codebases.
 */

import { writeFileSync } from 'node:fs'

const GITHUB_API = 'https://api.github.com'

const accessToken = mustEnv('GITHUB_ACCESS_TOKEN')
const apiKey = mustEnv('HISSUNO_API_KEY')
const projectId = mustEnv('HISSUNO_PROJECT_ID')
const baseUrl = process.env.HISSUNO_BASE_URL || 'http://localhost:3000'
const runInput = parseRunInput()
const repoFullName = mustString(runInput.repoFullName, 'repoFullName')
const branch = (runInput.branch as string | undefined) || 'main'

main().catch((err) => {
  console.error('[github-codebase] failed:', err instanceof Error ? err.message : String(err))
  process.exit(1)
})

async function main(): Promise<void> {
  const verified = await verifyRepo(repoFullName, branch)
  if (!verified.ok) {
    throw new Error(`GitHub repo not reachable: ${verified.error}`)
  }

  const repositoryUrl = `https://github.com/${repoFullName}`
  const body = {
    repository_url: repositoryUrl,
    repository_branch: branch,
    name: repoFullName,
  }
  const res = await hissunoFetch('POST', `/api/codebases?projectId=${encodeURIComponent(projectId)}`, body)
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`POST /api/codebases HTTP ${res.status}: ${text.slice(0, 200)}`)
  }

  const summary = { repoFullName, branch, registered: true }
  writeFileSync('output.json', JSON.stringify(summary, null, 2))
  console.log('[github-codebase]', JSON.stringify(summary))
}

async function verifyRepo(repo: string, branchName: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const url = `${GITHUB_API}/repos/${repo}/branches/${branchName}`
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  })
  if (res.ok) return { ok: true }
  const text = await res.text().catch(() => '')
  return { ok: false, error: `${res.status}: ${text.slice(0, 200)}` }
}

async function hissunoFetch(method: string, path: string, body?: unknown): Promise<Response> {
  return fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
}

function parseRunInput(): Record<string, unknown> {
  const raw = process.env.HISSUNO_RUN_INPUT
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

function mustString(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value) throw new Error(`Required input ${label} is missing.`)
  return value
}

function mustEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Required env var ${name} is missing.`)
  return value
}
