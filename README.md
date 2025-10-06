# 🌺 nectar
is a repeatable pipeline for debloating Next.js apps. It:
- builds a Next.js repo to measure its baseline bundle size and mount latency,
- statically analyzes code to find optimizations,
- suggests and applies safe transforms,
- rebuilds + remeasures,
- opens a PR with tiny diffs and a report (bytes saved + LCP/hydration deltas).

### Highlights
- impact-first: changes are ranked imperically with estimated KB/ms savings.
- safe by default: code changes are transactional with backups and a typecheck gate.
- unified diff: see the patch yourself before changes are applied (use `--dry` and  `--diff`).
- config-first: no magic, you decide what to optimize.
- portable artifacts: plan.json, diff.patch, or report.md — all are easy to pipe into CI or PRs.

### Installation

```bash
pnpm install
pnpm -s build # if you have a build step; otherwise skip
```

### Quickstart

```bash
# 1: discover & rank suggestions (writes .nectar/plan.json)
pnpm nectar codemod \
  --fixture examples/nectar-demo/manifest/build-manifest.json \
  --sizes   examples/nectar-demo/manifest/sizes.json \
  --json

# 2: preview changes as a unified diff
pnpm nectar codemod \
  --fixture examples/nectar-demo/manifest/build-manifest.json \
  --sizes   examples/nectar-demo/manifest/sizes.json \
  --diff --diff-out .nectar/diff.patch

# 3: apply the top suggestion (skip typecheck for now)
pnpm nectar codemod \
  --fixture examples/nectar-demo/manifest/build-manifest.json \
  --sizes   examples/nectar-demo/manifest/sizes.json \
  --limit 1 --apply --no-typecheck

# 4: tsmpo? rollback if needed
pnpm nectar restore

# 5: render a comment-style summary from artifacts
pnpm nectar render --format comment \
  --plan .nectar/plan.json \
  --diff .nectar/diff.patch \
  --out .nectar/comment.md
```

### Safety model
- backups: all edits go to `.nectar/backups/<timestamp>/...`.
- typecheck gate: runs `tsc --noEmit` after apply; if it fails, edits are reverted.
- dry runs: `--dry` is default.
- restore: `pnpm nectar restore` undoes everything, guaranteed.

### Config
Your codebase, your opinions; `nectar.config.json` drives behavior:
```json
{
  "heavyDeps": ["date-fns", "chart.js"],
  "dynamicAllowlist": ["Chart"],
  "rules": {
    "STAR_IMPORT_SLIMMING": true,
    "DYNAMIC_HEAVY_DEP": true
  },
  "thresholds": {
    "minEstimatedKB": 10
  },
  "ignore": ["**/dist/**", "**/.next/**"],
  "depth": 3
}
```
- heavyDeps: libs you consider heavy.
- dynamicAllowlist: component names safe to lazy-load.
- rules: toggle on/off at your discretion.
- thresholds.minEstimatedKB: drop nitpicky suggestions.
- ignore/depth: control what nectar sees.

Validate your config anytime with `pnpm nectar validate`.

### Command line cheatsheet
```bash
# analyze bundle + vendors (from fixture files)
pnpm nectar analyze --fixture path/to/build-manifest.json --sizes path/to/sizes.json

# discover + rank codemods
pnpm nectar codemod --fixture ... --sizes ... --json
pnpm nectar codemod --limit 5 --diff --diff-out .nectar/diff.patch
pnpm nectar codemod --only <id1,id2> --apply --no-typecheck
pnpm nectar codemod --except <id> --apply

# render artifacts to markdown or json (no side effects)
pnpm nectar render --format comment --plan .nectar/plan.json --diff .nectar/diff.patch --out .nectar/comment.md
pnpm nectar render --format summary --json --plan .nectar/plan.json

# rollback latest edits
pnpm nectar restore
```

### See for yourself
1. add a nectar config to your Next.js project as guided by the example above.
2. grab `build-manifest.json` and `sizes.json` from a CI build (or `/.next` locally).
3. run codemod with `--fixture`/`--sizes`, review the diff, apply some optimizations.
3. run your build + perf checks. Like it? Commit and open a PR.
3. optional: `render --format comment` to generate a neat PR body from artifacts.

### Roadmap
- ast-backed star-import slimming (keep regex fast-path).
- route-aware impact estimates (component → page mapping).
- extra rules (images, dynamic import() hints, server boundaries).
- SARIF / CI outputs.
- optional measurement attach for LCP/hydration.

### License

AGPL-3.0-or-later, see [LICENSE](./LICENSE).
