import { twMerge } from 'tailwind-merge'

type ClassValue = string | number | boolean | undefined | null | ClassValue[]

export function cn(...inputs: ClassValue[]): string {
  const combined = inputs
    .flat()
    .filter((x) => typeof x === 'string' && x.length > 0)
    .join(' ')
    .trim()
  return twMerge(combined)
}

