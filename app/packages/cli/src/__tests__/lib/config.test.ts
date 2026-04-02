import { describe, it, expect, vi, beforeEach } from 'vitest'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'

vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
}))

const mockExistsSync = existsSync as unknown as ReturnType<typeof vi.fn>
const mockReadFileSync = readFileSync as unknown as ReturnType<typeof vi.fn>
const mockWriteFileSync = writeFileSync as unknown as ReturnType<typeof vi.fn>

import {
  loadConfig,
  saveConfig,
  requireConfig,
  loadFullConfig,
  getActiveProfileName,
  type HissunoConfig,
} from '../../lib/config.js'

function setRawConfig(raw: unknown) {
  mockExistsSync.mockReturnValue(true)
  mockReadFileSync.mockReturnValue(JSON.stringify(raw))
}

describe('loadConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns null when no config file exists', () => {
    mockExistsSync.mockReturnValue(false)
    expect(loadConfig()).toBeNull()
  })

  it('returns null when config file is invalid JSON', () => {
    mockExistsSync.mockReturnValue(true)
    mockReadFileSync.mockReturnValue('not json')
    expect(loadConfig()).toBeNull()
  })

  it('loads legacy config with api_key', () => {
    setRawConfig({ api_key: 'hiss_abc', base_url: 'http://localhost:3000' })
    const config = loadConfig()
    expect(config).toEqual({ api_key: 'hiss_abc', base_url: 'http://localhost:3000' })
  })

  it('loads legacy config with auth_token', () => {
    setRawConfig({ auth_token: 'jwt-token-123', base_url: 'http://localhost:3000', username: 'alice' })
    const config = loadConfig()
    expect(config).toEqual({
      auth_token: 'jwt-token-123',
      base_url: 'http://localhost:3000',
      username: 'alice',
    })
  })

  it('loads legacy config with both api_key and auth_token', () => {
    setRawConfig({ api_key: 'hiss_abc', auth_token: 'jwt-123', base_url: 'http://localhost:3000' })
    const config = loadConfig()
    expect(config).toEqual({
      api_key: 'hiss_abc',
      auth_token: 'jwt-123',
      base_url: 'http://localhost:3000',
    })
  })

  it('returns null when legacy config has neither api_key nor auth_token', () => {
    setRawConfig({ base_url: 'http://localhost:3000' })
    expect(loadConfig()).toBeNull()
  })

  it('returns null when legacy config has no base_url or endpoint', () => {
    setRawConfig({ api_key: 'hiss_abc' })
    expect(loadConfig()).toBeNull()
  })

  it('derives base_url from legacy endpoint field', () => {
    setRawConfig({ api_key: 'hiss_abc', endpoint: 'http://localhost:3000/api/projects' })
    const config = loadConfig()
    expect(config?.base_url).toBe('http://localhost:3000')
  })

  it('includes project_id and username when present', () => {
    setRawConfig({
      auth_token: 'jwt-123',
      base_url: 'http://localhost:3000',
      project_id: 'proj-1',
      username: 'bob',
    })
    const config = loadConfig()
    expect(config?.project_id).toBe('proj-1')
    expect(config?.username).toBe('bob')
  })

  it('loads multi-profile config active profile', () => {
    setRawConfig({
      active_profile: 'staging',
      profiles: {
        default: { api_key: 'hiss_prod', base_url: 'https://app.hissuno.com' },
        staging: { auth_token: 'jwt-stg', base_url: 'http://localhost:3000', username: 'dev' },
      },
    })
    const config = loadConfig()
    expect(config).toEqual({
      auth_token: 'jwt-stg',
      base_url: 'http://localhost:3000',
      username: 'dev',
    })
  })

  it('returns null when active profile does not exist', () => {
    setRawConfig({
      active_profile: 'missing',
      profiles: { default: { api_key: 'hiss_abc', base_url: 'http://localhost:3000' } },
    })
    expect(loadConfig()).toBeNull()
  })
})

describe('saveConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('saves as flat config when no existing multi-profile', () => {
    mockExistsSync.mockReturnValue(false)
    const config: HissunoConfig = { auth_token: 'jwt-123', base_url: 'http://localhost:3000' }
    saveConfig(config)
    expect(mockWriteFileSync).toHaveBeenCalledTimes(1)
    const written = JSON.parse(mockWriteFileSync.mock.calls[0][1])
    expect(written.auth_token).toBe('jwt-123')
    expect(written.base_url).toBe('http://localhost:3000')
    expect(written.api_key).toBeUndefined()
  })

  it('saves to active profile in multi-profile config', () => {
    setRawConfig({
      active_profile: 'dev',
      profiles: {
        dev: { api_key: 'old-key', base_url: 'http://old' },
        prod: { api_key: 'hiss_prod', base_url: 'https://prod' },
      },
    })

    const config: HissunoConfig = { auth_token: 'jwt-new', base_url: 'http://new-url' }
    saveConfig(config)

    const written = JSON.parse(mockWriteFileSync.mock.calls[0][1])
    expect(written.profiles.dev).toEqual({ auth_token: 'jwt-new', base_url: 'http://new-url' })
    expect(written.profiles.prod).toEqual({ api_key: 'hiss_prod', base_url: 'https://prod' })
  })

  it('does not write api_key when absent', () => {
    mockExistsSync.mockReturnValue(false)
    saveConfig({ auth_token: 'jwt', base_url: 'http://localhost:3000' })
    const written = JSON.parse(mockWriteFileSync.mock.calls[0][1])
    expect(written).not.toHaveProperty('api_key')
  })

  it('does not write auth_token when absent', () => {
    mockExistsSync.mockReturnValue(false)
    saveConfig({ api_key: 'hiss_abc', base_url: 'http://localhost:3000' })
    const written = JSON.parse(mockWriteFileSync.mock.calls[0][1])
    expect(written).not.toHaveProperty('auth_token')
  })
})

describe('requireConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns config when api_key is present', () => {
    setRawConfig({ api_key: 'hiss_abc', base_url: 'http://localhost:3000' })
    const config = requireConfig()
    expect(config.api_key).toBe('hiss_abc')
  })

  it('returns config when auth_token is present', () => {
    setRawConfig({ auth_token: 'jwt-123', base_url: 'http://localhost:3000' })
    const config = requireConfig()
    expect(config.auth_token).toBe('jwt-123')
  })

  it('exits when no config exists', () => {
    mockExistsSync.mockReturnValue(false)
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    requireConfig()

    expect(exitSpy).toHaveBeenCalledWith(1)
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Not configured'))
    exitSpy.mockRestore()
    errorSpy.mockRestore()
  })

  it('exits when config has neither api_key nor auth_token', () => {
    setRawConfig({ base_url: 'http://localhost:3000' })
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    requireConfig()

    expect(exitSpy).toHaveBeenCalledWith(1)
    exitSpy.mockRestore()
    errorSpy.mockRestore()
  })
})

describe('loadFullConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('wraps legacy config into multi-profile format', () => {
    setRawConfig({ auth_token: 'jwt-123', base_url: 'http://localhost:3000' })
    const full = loadFullConfig()
    expect(full).toEqual({
      active_profile: 'default',
      profiles: {
        default: { auth_token: 'jwt-123', base_url: 'http://localhost:3000' },
      },
    })
  })
})

describe('getActiveProfileName', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns active profile name from multi-profile config', () => {
    setRawConfig({ active_profile: 'staging', profiles: { staging: {} } })
    expect(getActiveProfileName()).toBe('staging')
  })

  it('returns "default" for legacy config', () => {
    setRawConfig({ api_key: 'hiss_abc', base_url: 'http://localhost:3000' })
    expect(getActiveProfileName()).toBe('default')
  })
})
