import fs from 'node:fs/promises'
import path from 'node:path'

type Metrics = {
  routes: Record<
    string,
    { LCP?: number; FCP?: number; TBT?: number; CLS?: number; score?: number }
  >
}

export const dynamic = 'force-dynamic'

export default async function BenchmarksPage() {
  const repoRoot = path.join(process.cwd(), '..', '..')
  const metricsPath = path.join(repoRoot, '.nectar/metrics.json')
  const reportPath = path.join(repoRoot, '.nectar/report.md')

  let metrics: Metrics | null = null
  let report: string | null = null
  try {
    const raw = await fs.readFile(metricsPath, 'utf8')
    metrics = JSON.parse(raw)
  } catch {}

  try {
    report = await fs.readFile(reportPath, 'utf8')
  } catch {}

  if (!metrics) {
    return (
      <main className="mx-auto max-w-3xl p-6 md:p-12">
        <h1 className="text-3xl font-bold">Benchmarks</h1>
        <p className="mt-2 text-muted-foreground">
          No metrics found. Run Nectar to generate benchmark artifacts.
        </p>
        <pre className="mt-6 overflow-x-auto rounded-2xl border bg-card p-4 text-sm">
{`nectar analyze --fixture <manifest.json> --sizes <sizes.json>
nectar measure --base http://localhost:3000 --routes '[/]' --runs 3`}
        </pre>
      </main>
    )
  }

  const rows = Object.entries(metrics.routes)

  return (
    <main className="mx-auto max-w-5xl p-6 md:p-12">
      <h1 className="text-3xl font-bold">Benchmarks</h1>
      <div className="mt-6 overflow-hidden rounded-2xl border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="px-4 py-2">Route</th>
              <th className="px-4 py-2">LCP</th>
              <th className="px-4 py-2">FCP</th>
              <th className="px-4 py-2">TBT</th>
              <th className="px-4 py-2">CLS</th>
              <th className="px-4 py-2">Score</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([route, m]) => (
              <tr key={route} className="border-t">
                <td className="px-4 py-2 font-medium">{route}</td>
                <td className="px-4 py-2">{m.LCP ?? '-'}</td>
                <td className="px-4 py-2">{m.FCP ?? '-'}</td>
                <td className="px-4 py-2">{m.TBT ?? '-'}</td>
                <td className="px-4 py-2">{m.CLS ?? '-'}</td>
                <td className="px-4 py-2">{m.score ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {report && (
        <div className="prose prose-slate mt-8 max-w-none rounded-2xl border bg-card p-6 dark:prose-invert">
          <h2>Summary</h2>
          <pre className="whitespace-pre-wrap text-sm">{report}</pre>
        </div>
      )}
    </main>
  )
}

