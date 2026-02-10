'use client'

import type { UsageMetrics } from '@/types/billing'
import { FloatingCard } from '@/components/ui/floating-card'
import { Heading } from '@/components/ui'

interface UsageSectionProps {
  usage: UsageMetrics
}

export function UsageSection({ usage }: UsageSectionProps) {
  const { analyzedSessionsUsed, analyzedSessionsLimit, projectsUsed, projectsLimit, periodStart, periodEnd } =
    usage

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })
  }

  const getUsagePercentage = (used: number, limit: number | null) => {
    if (!limit) return 0
    return Math.min((used / limit) * 100, 100)
  }

  const getProgressColor = (percentage: number) => {
    if (percentage >= 90) return 'bg-red-500'
    if (percentage >= 75) return 'bg-yellow-500'
    return 'bg-green-500'
  }

  const analyzedSessionsPercentage = getUsagePercentage(analyzedSessionsUsed, analyzedSessionsLimit)
  const projectsPercentage = getUsagePercentage(projectsUsed, projectsLimit)

  return (
    <FloatingCard
      floating="gentle"
      variant="elevated"
      className="space-y-4 border border-slate-200 bg-white/70 p-8 dark:border-slate-800 dark:bg-slate-900/60"
    >
      <div>
        <Heading as="h2" size="section">Usage This Period</Heading>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {formatDate(periodStart)} - {periodEnd ? formatDate(periodEnd) : 'Now'}
        </p>
      </div>

      <div className="space-y-6">
        {/* Analyzed Sessions Usage */}
        <div>
          <div className="mb-2 flex items-end justify-between">
            <span className="text-sm text-slate-600 dark:text-slate-400">Analyzed Sessions</span>
            <span className="text-2xl font-bold text-slate-900 dark:text-slate-50">
              {analyzedSessionsUsed.toLocaleString()}
              {analyzedSessionsLimit !== null ? (
                <span className="text-base font-normal text-slate-500">
                  {' '}
                  / {analyzedSessionsLimit.toLocaleString()}
                </span>
              ) : (
                <span className="text-base font-normal text-slate-500"> / Unlimited</span>
              )}
            </span>
          </div>

          {analyzedSessionsLimit !== null && (
            <>
              <div className="h-3 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                <div
                  className={`h-full transition-all duration-300 ${getProgressColor(analyzedSessionsPercentage)}`}
                  style={{ width: `${analyzedSessionsPercentage}%` }}
                />
              </div>

              {analyzedSessionsPercentage >= 75 && (
                <p className="mt-2 text-sm text-yellow-600 dark:text-yellow-400">
                  {analyzedSessionsPercentage >= 90
                    ? 'You are approaching your analyzed feedback limit. Consider upgrading.'
                    : 'You have used over 75% of your analyzed feedback.'}
                </p>
              )}
            </>
          )}
        </div>

        {/* Projects Usage */}
        <div>
          <div className="mb-2 flex items-end justify-between">
            <span className="text-sm text-slate-600 dark:text-slate-400">Projects</span>
            <span className="text-2xl font-bold text-slate-900 dark:text-slate-50">
              {projectsUsed.toLocaleString()}
              {projectsLimit !== null ? (
                <span className="text-base font-normal text-slate-500">
                  {' '}
                  / {projectsLimit.toLocaleString()}
                </span>
              ) : (
                <span className="text-base font-normal text-slate-500"> / Unlimited</span>
              )}
            </span>
          </div>

          {projectsLimit !== null && (
            <>
              <div className="h-3 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                <div
                  className={`h-full transition-all duration-300 ${getProgressColor(projectsPercentage)}`}
                  style={{ width: `${projectsPercentage}%` }}
                />
              </div>

              {projectsPercentage >= 75 && (
                <p className="mt-2 text-sm text-yellow-600 dark:text-yellow-400">
                  {projectsPercentage >= 90
                    ? 'You are approaching your project limit. Consider upgrading.'
                    : 'You have used over 75% of your projects.'}
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </FloatingCard>
  )
}
