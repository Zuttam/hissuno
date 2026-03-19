import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('node:child_process', () => ({
  exec: vi.fn(),
}))

vi.mock('node:os', () => ({
  platform: vi.fn(),
}))

import { exec } from 'node:child_process'
import { platform } from 'node:os'
import { openBrowser } from '../../lib/browser.js'

const mockPlatform = platform as unknown as ReturnType<typeof vi.fn>
const mockExec = exec as unknown as ReturnType<typeof vi.fn>

describe('openBrowser', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('uses "open" on macOS', () => {
    mockPlatform.mockReturnValue('darwin')
    openBrowser('https://example.com')
    expect(mockExec).toHaveBeenCalledWith('open "https://example.com"')
  })

  it('uses "start" on Windows', () => {
    mockPlatform.mockReturnValue('win32')
    openBrowser('https://example.com')
    expect(mockExec).toHaveBeenCalledWith('start "https://example.com"')
  })

  it('uses "xdg-open" on Linux', () => {
    mockPlatform.mockReturnValue('linux')
    openBrowser('https://example.com')
    expect(mockExec).toHaveBeenCalledWith('xdg-open "https://example.com"')
  })
})
