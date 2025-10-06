import type { ReactNode } from 'react'
import Link from 'next/link'

export default function DocsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 p-6 md:grid-cols-[220px_1fr] md:py-12">
      <aside className="rounded-2xl border bg-card p-4">
        <nav className="text-sm">
          <ul className="space-y-2">
            <li>
              <Link href="/docs" className="hover:underline">
                Docs Index
              </Link>
            </li>
            <li>
              <Link href="/docs/get-started" className="hover:underline">
                Get Started
              </Link>
            </li>
          </ul>
        </nav>
      </aside>
      <div className="prose prose-slate max-w-none dark:prose-invert">
        {children}
      </div>
    </div>
  )
}

