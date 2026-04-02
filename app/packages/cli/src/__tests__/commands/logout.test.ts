import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
}))

import { existsSync, readFileSync, writeFileSync } from 'node:fs'

const mockExistsSync = existsSync as unknown as ReturnType<typeof vi.fn>
const mockReadFileSync = readFileSync as unknown as ReturnType<typeof vi.fn>
const mockWriteFileSync = writeFileSync as unknown as ReturnType<typeof vi.fn>

import { loadConfig, saveConfig } from '../../lib/config.js'

describe('logout behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loadConfig returns config without auth_token after token is removed', () => {
    // Simulate a config with auth_token
    const raw = {
      auth_token: 'jwt-123',
      base_url: 'http://localhost:3000',
      username: 'alice',
      project_id: 'proj-1',
    }
    mockExistsSync.mockReturnValue(true)
    mockReadFileSync.mockReturnValue(JSON.stringify(raw))

    const config = loadConfig()
    expect(config?.auth_token).toBe('jwt-123')

    // Simulate logout: delete auth_token, save
    delete config!.auth_token
    saveConfig(config!)

    // Verify saved config has no auth_token
    const written = JSON.parse(mockWriteFileSync.mock.calls[0][1])
    expect(written).not.toHaveProperty('auth_token')
    expect(written.base_url).toBe('http://localhost:3000')
  })

  it('handles config with no auth_token gracefully', () => {
    mockExistsSync.mockReturnValue(true)
    mockReadFileSync.mockReturnValue(JSON.stringify({
      api_key: 'hiss_abc',
      base_url: 'http://localhost:3000',
    }))

    const config = loadConfig()
    expect(config?.auth_token).toBeUndefined()
  })

  it('logout preserves api_key when only clearing auth_token', () => {
    const raw = {
      api_key: 'hiss_abc',
      auth_token: 'jwt-123',
      base_url: 'http://localhost:3000',
    }
    mockExistsSync.mockReturnValue(true)
    mockReadFileSync.mockReturnValue(JSON.stringify(raw))

    const config = loadConfig()
    delete config!.auth_token
    saveConfig(config!)

    const written = JSON.parse(mockWriteFileSync.mock.calls[0][1])
    expect(written.api_key).toBe('hiss_abc')
    expect(written).not.toHaveProperty('auth_token')
  })

  it('logout in multi-profile config only affects active profile', () => {
    const raw = {
      active_profile: 'dev',
      profiles: {
        dev: { auth_token: 'jwt-dev', base_url: 'http://dev' },
        prod: { auth_token: 'jwt-prod', base_url: 'https://prod' },
      },
    }
    mockExistsSync.mockReturnValue(true)
    mockReadFileSync.mockReturnValue(JSON.stringify(raw))

    const config = loadConfig()
    delete config!.auth_token
    saveConfig(config!)

    const written = JSON.parse(mockWriteFileSync.mock.calls[0][1])
    expect(written.profiles.dev).not.toHaveProperty('auth_token')
    expect(written.profiles.prod.auth_token).toBe('jwt-prod')
  })
})
