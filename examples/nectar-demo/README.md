# nectar-demo

is a minimal example demonstrating Nectar's bundle optimization capabilities. It includes two optimization opportunities:

1. **STAR_IMPORT_SLIMMING** (`src/pages/date.tsx`)
   - uses `import * as dateFns from 'date-fns'`
   - nectar can convert this to tree-shakeable subpath imports
   - estimated savings: ~95 KB

2. **DYNAMIC_HEAVY_DEP** (`src/components/Chart.tsx`)
   - uses `import Chart from 'chart.js'` as a static import
   - nectar can wrap it with `next/dynamic({ ssr: false })`
   - estimated savings: ~180 KB (deferred loading)

## Quick Start

From the repo root:

```bash
# analyze and create plan
npm run demo:plan

# preview changes
npm run demo:diff

# apply changes (with automatic backup)
npm run demo:apply

# restore original files
npm run demo:restore

# render markdown comment
npm run demo:render
```

## Configuration

See `nectar.config.json` for:
- `heavyDeps`: list of packages to optimize
- `dynamicAllowlist`: path hints for dynamic() wrapping
- `thresholds`: minimum savings thresholds for reporting

