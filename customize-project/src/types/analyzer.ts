export type AnalysisSource =
  | { kind: 'path'; value: string }
  | { kind: 'upload'; filename: string }

export interface AnalyzerRequest {
  prompt?: string
  source: AnalysisSource
}

export interface AnalyzerWarning {
  code: string
  message: string
  suggestion?: string
}

export interface DesignToken {
  name: string
  value: string
  description?: string
}

export interface ComponentUsage {
  name: string
  description?: string
  filePath: string
  examples?: string[]
}

export interface ApiEndpointSummary {
  method: string
  path: string
  description?: string
  filePath: string
}

export interface DesignSystemSummary {
  tokens: DesignToken[]
  components: ComponentUsage[]
}

export interface ApiSurfaceSummary {
  endpoints: ApiEndpointSummary[]
}

export interface AnalyzerResult {
  designSystem: DesignSystemSummary
  apiSurface: ApiSurfaceSummary
  stats: {
    fileCount: number
    componentCount: number
    apiCount: number
  }
  warnings: AnalyzerWarning[]
}

export interface AnalyzerResponse {
  id: string
  requestedAt: string
  prompt?: string
  source: AnalysisSource
  result: AnalyzerResult
}

export interface AnalyzerHistoryItem {
  id: string
  prompt?: string
  source: AnalysisSource
  requestedAt: string
}

