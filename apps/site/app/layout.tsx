import type { Metadata } from 'next'
import './globals.css'
import { clsx } from 'clsx'
import { ThemeToggle } from './theme-toggle'
import { Analytics } from './analytics'

export const metadata: Metadata = {
  title: {
    default: 'Nectar – Static, safe codemods for Next.js',
    template: '%s – Nectar'
  },
  description:
    'Static + safe codemods for Next.js RSC & bundle bloat. Transactional apply. Type-safe rollback. CI-friendly.',
  openGraph: {
    title: 'Nectar',
    description:
      'Static + safe codemods for Next.js RSC & bundle bloat. Transactional apply. Type-safe rollback. CI-friendly.',
    images: [{ url: '/og', width: 1200, height: 630 }]
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Nectar',
    description:
      'Static + safe codemods for Next.js RSC & bundle bloat. Transactional apply. Type-safe rollback. CI-friendly.'
  },
  metadataBase: new URL('https://example.com')
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={clsx('min-h-screen bg-background text-foreground antialiased')}>
        {children}
        <Analytics />
        <ThemeToggle />
      </body>
    </html>
  )
}

