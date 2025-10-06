import Link from 'next/link'
import { ArrowRight, Sparkles, Gauge, GitPullRequest } from 'lucide-react'

export default function Page() {
  return (
    <main className="px-6 py-12 md:py-20">
      <section className="mx-auto max-w-5xl text-center">
        <div className="inline-flex items-center gap-2 rounded-2xl border bg-card px-3 py-1 text-sm text-muted-foreground shadow-soft">
          <Sparkles className="h-4 w-4" aria-hidden="true" />
          Static + safe codemods for Next.js
        </div>
        <h1 className="mt-6 text-4xl font-bold tracking-tight md:text-6xl">
          Nectar
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
          Static + safe codemods for Next.js RSC & bundle bloat. Transactional apply. Type-safe rollback. CI-friendly.
        </p>
        <div className="mt-8 flex justify-center gap-4">
          <Link href="/docs/get-started" className="inline-flex items-center rounded-xl bg-primary px-5 py-3 font-medium text-primary-foreground shadow-soft transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
            Read the Docs
            <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
          </Link>
          <a href="https://github.com/" target="_blank" rel="noreferrer" className="inline-flex items-center rounded-xl border px-5 py-3 font-medium shadow-soft hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
            Run Nectar
          </a>
        </div>
      </section>

      <section className="mx-auto mt-16 grid max-w-6xl grid-cols-1 gap-6 md:mt-24 md:grid-cols-3">
        {[
          {
            title: 'Config-first, no magic',
            desc: 'Declarative rules. Deterministic results. Keep control in your repo.'
          },
          {
            title: 'Star-import slimming + dynamic heavy deps',
            desc: 'Shrink bundles with safe star import slimming and dynamic wrappers.'
          },
          {
            title: 'Estimated KB before apply',
            desc: 'See the impact up-front based on your manifest + sizes.'
          },
          {
            title: 'Transactional apply + typecheck rollback',
            desc: 'Revert on type errors automatically to keep main green.'
          },
          {
            title: 'Plan files & PR summaries',
            desc: 'Clear plans and neat PRs with before/after bytes & UX.'
          },
          {
            title: 'CI-friendly',
            desc: 'Safe to run in CI with JSON outputs and plan review.'
          }
        ].map((f) => (
          <div key={f.title} className="rounded-2xl border bg-card p-6 shadow-soft">
            <h3 className="text-lg font-semibold">{f.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
          </div>
        ))}
      </section>

      <section className="mx-auto mt-16 max-w-5xl md:mt-24">
        <div className="rounded-2xl border bg-card p-6 shadow-soft">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Gauge className="h-4 w-4" aria-hidden="true" />
            How Nectar Works
          </div>
          <ol className="mt-4 list-decimal space-y-2 pl-6 text-sm text-muted-foreground">
            <li>Analyze your project to estimate bytes and opportunities.</li>
            <li>Plan safe transforms with clear rollbacks.</li>
            <li>Apply transactionally. If typecheck fails, roll back.</li>
            <li>Measure again and open a PR with a concise report.</li>
          </ol>
          <div className="mt-4 text-sm">
            <Link href="/benchmarks" className="inline-flex items-center text-primary underline-offset-2 hover:underline">
              See Benchmarks
              <GitPullRequest className="ml-2 h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
        <div className="mt-6 rounded-2xl border bg-card p-4 shadow-soft">
          <pre className="overflow-x-auto text-xs">
{`# Try Nectar locally
pnpm nectar init --write
pnpm nectar analyze --fixture <manifest.json> --sizes <sizes.json>
pnpm nectar codemod --json
pnpm nectar codemod --apply --plan .nectar/plan.json`}
          </pre>
        </div>
      </section>
    </main>
  )
}

