"use client"
import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { useAnalytics } from '@/lib/utils'

export function Analytics() {
  const { track } = useAnalytics()
  const pathname = usePathname()
  useEffect(() => {
    track('pageview', { pathname })
  }, [pathname, track])
  return null
}

