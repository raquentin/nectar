import Chart from 'chart.js';

export function ChartWidget() {
  return (
    <div>
      <h2>Chart Component</h2>
      <p>Using chart.js: {Chart.version || 'loaded'}</p>
    </div>
  );
}

