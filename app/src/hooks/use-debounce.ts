'use client'

import { useState, useEffect, useRef } from 'react'

export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState(value)
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)
    return () => clearTimeout(timerRef.current)
  }, [value, delay])

  return debouncedValue
}
