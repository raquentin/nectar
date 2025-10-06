"use client"
import { useEffect, useRef } from 'react'
import { Chart, LineController, LineElement, PointElement, LinearScale, Title, CategoryScale } from 'chart.js'

Chart.register(LineController, LineElement, PointElement, LinearScale, Title, CategoryScale)

export default function ChartExample() {
  const ref = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    if (!ref.current) return
    const ctx = ref.current.getContext('2d')
    if (!ctx) return
    const chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
        datasets: [
          {
            label: 'Visitors',
            data: [12, 19, 3, 5, 2, 3],
            borderColor: 'hsl(217.2 91.2% 59.8%)',
            tension: 0.3
          }
        ]
      }
    })
    return () => chart.destroy()
  }, [])

  return (
    <main className="mx-auto max-w-3xl p-6 md:p-12">
      <h1 className="text-2xl font-bold">Chart.js Example</h1>
      <p className="mt-2 text-muted-foreground text-sm">Intentionally imports chart.js as a heavy client dependency.</p>
      <div className="mt-6 rounded-2xl border bg-card p-4 shadow-soft">
        <canvas ref={ref} height={200} />
      </div>
    </main>
  )
}

