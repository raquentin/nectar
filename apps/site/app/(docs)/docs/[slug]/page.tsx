import fs from 'node:fs/promises'
import path from 'node:path'
import { notFound } from 'next/navigation'
import { MDXRemote } from 'next-mdx-remote/rsc'
import remarkGfm from 'remark-gfm'
import rehypeSlug from 'rehype-slug'
import rehypeAutolinkHeadings from 'rehype-autolink-headings'

export const dynamic = 'force-static'

export async function generateStaticParams() {
  const contentDir = path.join(process.cwd(), 'content')
  try {
    const files = await fs.readdir(contentDir)
    return files
      .filter((f) => f.endsWith('.mdx'))
      .map((f) => ({ slug: f.replace(/\.mdx$/, '') }))
  } catch {
    return []
  }
}

export default async function DocPage({ params }: { params: { slug: string } }) {
  const filePath = path.join(process.cwd(), 'content', `${params.slug}.mdx`)
  let source: string
  try {
    source = await fs.readFile(filePath, 'utf8')
  } catch {
    notFound()
  }
  return (
    <article className="p-6 md:p-12">
      <nav className="mb-4 text-sm text-muted-foreground">
        <a href="/" className="hover:underline">Home</a> / <a href="/docs" className="hover:underline">Docs</a> / {params.slug}
      </nav>
      {/* MDX rendered in RSC via next-mdx-remote/rsc */}
      {/* eslint-disable-next-line @typescript-eslint/no-non-null-assertion */}
      <MDXRemote source={source!} options={{ mdxOptions: { remarkPlugins: [remarkGfm], rehypePlugins: [rehypeSlug, rehypeAutolinkHeadings] } }} />
    </article>
  )
}

