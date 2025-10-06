import fs from 'node:fs/promises'
import path from 'node:path'
import Link from 'next/link'

export const dynamic = 'force-static'

export default async function DocsIndex() {
  const contentDir = path.join(process.cwd(), 'content')
  let entries: string[] = []
  try {
    const files = await fs.readdir(contentDir)
    entries = files.filter((f) => f.endsWith('.mdx')).map((f) => f.replace(/\.mdx$/, ''))
  } catch {
    entries = []
  }
  return (
    <main className="p-6 md:p-12">
      <h1 className="text-3xl font-bold">Docs</h1>
      <ul className="mt-4 space-y-2">
        {entries.map((slug) => (
          <li key={slug}>
            <Link className="text-primary hover:underline" href={`/docs/${slug}`}>
              {slug}
            </Link>
          </li>
        ))}
        {entries.length === 0 && <li className="text-muted-foreground">No docs yet.</li>}
      </ul>
    </main>
  )
}

