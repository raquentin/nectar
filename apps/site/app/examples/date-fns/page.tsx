import * as dateFns from 'date-fns'

export const dynamic = 'force-static'

export default function DateFnsExample() {
  const now = new Date()
  const inTenDays = dateFns.addDays(now, 10)
  return (
    <main className="mx-auto max-w-3xl p-6 md:p-12">
      <h1 className="text-2xl font-bold">date-fns Star Import Example</h1>
      <p className="mt-2 text-muted-foreground text-sm">
        Uses import * as dateFns to intentionally pull more than needed.
      </p>
      <div className="mt-6 rounded-2xl border bg-card p-4">
        <p>
          Today: <strong>{dateFns.format(now, 'PPPP')}</strong>
        </p>
        <p className="mt-2">
          In 10 days: <strong>{dateFns.format(inTenDays, 'PPPP')}</strong>
        </p>
      </div>
    </main>
  )
}

