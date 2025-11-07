'use client'

import type { AnalyzerResponse } from '@/types/analyzer'

interface AnalysisTabsProps {
  analysis: AnalyzerResponse | null
  selectedTab: 'design' | 'api'
  onTabChange: (tab: 'design' | 'api') => void
}

export function AnalysisTabs({ analysis, selectedTab, onTabChange }: AnalysisTabsProps) {
  if (!analysis) {
    return (
      <div className="flex h-full flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white/70 text-center dark:border-slate-800 dark:bg-slate-900/60">
        <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-200">
          Run an analysis to see results
        </h3>
        <p className="mt-2 max-w-md text-sm text-slate-500 dark:text-slate-400">
          Upload a project archive or point to a local directory. Your design system and API surfaces will show up here in a Lovable-style preview.
        </p>
      </div>
    )
  }

  const { designSystem, apiSurface, warnings } = analysis.result

  return (
    <div className="flex h-full flex-col rounded-3xl border border-slate-200 bg-white/80 shadow-xl shadow-slate-200/40 dark:border-slate-800 dark:bg-slate-900/70 dark:shadow-none">
      <div className="flex items-center gap-4 border-b border-slate-200 px-6 py-4 dark:border-slate-800">
        <button
          type="button"
          onClick={() => onTabChange('design')}
          className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
            selectedTab === 'design'
              ? 'bg-slate-900 text-white shadow-lg dark:bg-white/90 dark:text-slate-900'
              : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
          }`}
        >
          Design system & components
        </button>
        <button
          type="button"
          onClick={() => onTabChange('api')}
          className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
            selectedTab === 'api'
              ? 'bg-slate-900 text-white shadow-lg dark:bg-white/90 dark:text-slate-900'
              : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
          }`}
        >
          APIs
        </button>
      </div>

      {warnings.length > 0 && (
        <div className="mx-6 mt-4 space-y-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
          <p className="font-medium uppercase tracking-wide text-xs text-amber-700 dark:text-amber-300">
            Insights
          </p>
          <ul className="space-y-1">
            {warnings.map((warning, index) => (
              <li key={`${warning.code}-${index}`}>
                <span className="font-medium">{warning.message}</span>
                {warning.suggestion && <span className="ml-1 text-xs text-amber-600 dark:text-amber-300">{warning.suggestion}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-6 py-4">
        {selectedTab === 'design' ? (
          <div className="space-y-8">
            <section>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
                Design tokens
              </h3>
              {designSystem.tokens.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                  No design tokens were detected in the provided sources.
                </p>
              ) : (
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {designSystem.tokens.map((token) => (
                    <div
                      key={`${token.name}-${token.value}`}
                      className="rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-900"
                    >
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                        {token.name}
                      </p>
                      <p className="mt-1 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        {token.value}
                      </p>
                      {token.description && (
                        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                          {token.description}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
                Components
              </h3>
              {designSystem.components.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                  No exported React components were found.
                </p>
              ) : (
                <div className="mt-4 space-y-4">
                  {designSystem.components.map((component) => (
                    <div
                      key={`${component.filePath}-${component.name}`}
                      className="rounded-2xl border border-slate-200 bg-white/90 px-5 py-4 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-base font-semibold text-slate-800 dark:text-slate-100">
                          {component.name}
                        </p>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                          {component.filePath}
                        </span>
                      </div>
                      {component.description && (
                        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                          {component.description}
                        </p>
                      )}
                      {component.examples && component.examples.length > 0 && (
                        <div className="mt-3 space-y-2 text-xs text-slate-500 dark:text-slate-400">
                          {component.examples.map((example, index) => (
                            <pre
                              key={index}
                              className="overflow-x-auto rounded-lg bg-slate-900/90 px-3 py-2 font-mono text-[11px] text-slate-100"
                            >
                              {example}
                            </pre>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        ) : (
          <section>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
              API endpoints
            </h3>
            {apiSurface.endpoints.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                No API handlers were found in the inspected files.
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                {apiSurface.endpoints.map((endpoint) => (
                    <div
                      key={`${endpoint.filePath}-${endpoint.method}-${endpoint.path}`}
                      className="rounded-2xl border border-slate-200 bg-white/90 px-5 py-4 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
                  >
                    <div className="flex items-center gap-3">
                      <span className="rounded-md bg-linear-to-r from-blue-500 to-indigo-500 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-white">
                        {endpoint.method}
                      </span>
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                        {endpoint.path}
                      </p>
                    </div>
                    <p className="mt-2 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      {endpoint.filePath}
                    </p>
                    {endpoint.description && (
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        {endpoint.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  )
}

