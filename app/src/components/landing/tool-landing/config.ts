export interface ToolConfig {
  id: string
  name: string
  logo: string
  tagline: string
  utmContent: string
}

export const SUPPORTED_TOOLS: Record<string, ToolConfig> = {
  lovable: {
    id: 'lovable',
    name: 'Lovable',
    logo: '/logos/lovable.svg',
    tagline: 'You built your product in days with Lovable.',
    utmContent: 'lovable',
  },
  base44: {
    id: 'base44',
    name: 'Base44',
    logo: '/logos/base44.png',
    tagline: 'You built your product in days with Base44.',
    utmContent: 'base44',
  },
}

export function getToolConfig(tool: string): ToolConfig | undefined {
  return SUPPORTED_TOOLS[tool.toLowerCase()]
}

export function getSupportedToolSlugs(): string[] {
  return Object.keys(SUPPORTED_TOOLS)
}
