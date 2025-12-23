import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MarkdownViewer } from '../markdown-viewer'

// Mock react-markdown
vi.mock('react-markdown', () => ({
  default: ({ children }: { children: string }) => <div>{children}</div>,
}))

// Mock rehype-highlight
vi.mock('rehype-highlight', () => ({
  default: () => {},
}))

// Mock UI components
vi.mock('@/components/ui', () => ({
  Spinner: () => <div>Loading...</div>,
}))

global.fetch = vi.fn()

describe('MarkdownViewer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should show loading state initially', () => {
    ;(global.fetch as any).mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({ ok: true, text: () => '# Test' }), 100))
    )

    render(<MarkdownViewer url="https://example.com/test.md" />)

    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('should render markdown content', async () => {
    ;(global.fetch as any).mockResolvedValue({
      ok: true,
      text: async () => '# Test Markdown\n\nHello world',
    })

    render(<MarkdownViewer url="https://example.com/test.md" />)

    await waitFor(() => {
      expect(screen.getByText(/Test Markdown/)).toBeInTheDocument()
    })
  })

  it('should show error message on fetch failure', async () => {
    ;(global.fetch as any).mockRejectedValue(new Error('Network error'))

    render(<MarkdownViewer url="https://example.com/test.md" />)

    await waitFor(() => {
      expect(screen.getByText(/Failed to load documentation/)).toBeInTheDocument()
    })
  })
})

