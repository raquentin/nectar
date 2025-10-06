import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function useAnalytics() {
  // Placeholder for pluggable analytics. No-op by default.
  return {
    track: (_event: string, _props?: Record<string, unknown>) => {}
  }
}

