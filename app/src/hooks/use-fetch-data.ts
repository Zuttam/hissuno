'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

interface UseFetchDataOptions<T> {
  fetchFn: () => Promise<T | null>
  deps: unknown[]
  initialData?: T | null
  initialLoading?: boolean
  errorPrefix?: string
  skip?: boolean
}

interface UseFetchDataResult<T> {
  data: T | null
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
}

export function useFetchData<T>({
  fetchFn,
  deps,
  initialData = null,
  initialLoading = true,
  errorPrefix = 'Unexpected error',
  skip = false,
}: UseFetchDataOptions<T>): UseFetchDataResult<T> {
  const [data, setData] = useState<T | null>(initialData)
  const [isLoading, setIsLoading] = useState<boolean>(initialLoading)
  const [error, setError] = useState<string | null>(null)

  // Use refs for values needed in doFetch but that should NOT trigger re-fetches
  const initialDataRef = useRef(initialData)
  initialDataRef.current = initialData
  const errorPrefixRef = useRef(errorPrefix)
  errorPrefixRef.current = errorPrefix

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stableFetchFn = useCallback(fetchFn, deps)

  const doFetch = useCallback(async () => {
    if (skip) {
      setData(initialDataRef.current ?? null)
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    setError(null)
    try {
      const result = await stableFetchFn()
      setData(result)
    } catch (err) {
      const message = err instanceof Error ? err.message : `${errorPrefixRef.current}.`
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }, [stableFetchFn, skip])

  useEffect(() => {
    void doFetch()
  }, [doFetch])

  return useMemo(
    () => ({ data, isLoading, error, refresh: doFetch }),
    [data, isLoading, error, doFetch]
  )
}
