import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '🌺 Nectar for Next.js',
  description: 'A repeatable pipeline for debloating Next.js apps with impact-first optimizations and safe transforms.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
