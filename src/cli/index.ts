import fs from "node:fs/promises";
import path from "node:path";

import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import pc from "picocolors";

import { loadConfig } from "../lib/config.js";
import { readBundleSnapshot } from "../lib/bundle.js";
import { estimateImpact } from "../lib/impact.js";
import { writePlan, readPlan } from "../lib/plan.js";
import { runTypecheck } from "../lib/typecheck.js";
import { suggestionId } from "../lib/id.js";
import { validateConfigFile } from "../lib/validateConfig.js";
import { writeReport } from "../lib/report.js";
import { maybePrintJSON } from "../lib/jsonOut.js";
import { restoreLatestBackup } from "../lib/restore.js";
import { loadPlan, loadTextIfExists, filterItems, renderSummaryMD, renderCommentMD, renderJSON, totals } from "../lib/render.js";
import { detectServerOnlyInClient } from "../analyze/boundary.js";
import { detectDuplicateVendors } from "../analyze/dupVendors.js";
import { proposeConfig } from "../init/scanDeps.js";
import { measureAttach } from "../measure/attach.js";

import {
    suggestStarImportSlimming,
    suggestDynamicHeavyDep,
    applyStarImportSlimming,
    applyDynamicHeavyDep,
    previewStarImportSlimming,
    previewDynamicHeavyDep,
    restoreBackups,
    type ApplyResult
} from "../codemod/index.js";

export function runCli() {
    yargs(hideBin(process.argv))
        .command("analyze",
            "analyze using cached build or fixture",
            (y) => y
                .option("fixture", { type: "string", describe: "Path to build-manifest.json fixture" })
                .option("sizes", { type: "string", describe: "Path to sizes.json (assetPath -> bytes)" })
                .option("json", { type: "boolean", default: false, describe: "Print JSON result to stdout" }),
            async (argv) => {
                const cfg = await loadConfig();
                const snap = await readBundleSnapshot(process.cwd(), argv.fixture as string | undefined, argv.sizes as string | undefined);
                if (!snap) { console.log(pc.yellow("No manifest found.")); return; }
                const dup = detectDuplicateVendors(snap, cfg);
                await writeReport(snap, dup);
                maybePrintJSON(argv.json, { snapshot: snap, dupVendors: dup, config: cfg });

                const findings = await detectServerOnlyInClient();
                if (findings.length) {
                    console.log(pc.red(`Server-only-in-client: ${findings.length}`));
                    for (const f of findings.slice(0, 8)) console.log(`  - ${f.file}: ${f.message}`);
                } else console.log(pc.green("No server-only-in-client issues."));
            })
        .command(
            "codemod",
            "suggest or apply codemods (ranked by estimated KB)",
            (y) =>
                y
                    .option("dry", { type: "boolean", default: true, describe: "Preview changes only" })
                    .option("apply", { type: "boolean", default: false, describe: "Apply changes (overrides --dry)" })
                    .option("rule", { type: "string", choices: ["STAR_IMPORT_SLIMMING", "DYNAMIC_HEAVY_DEP"], describe: "Filter to one rule" })
                    .option("plan", { type: "string", describe: "Apply from an existing plan.json (overrides discovery)" })
                    .option("out", { type: "string", default: ".nectar", describe: "Directory for artifacts (plan.json, findings.json)" })
                    .option("fixture", { type: "string", describe: "Optional path to build-manifest.json for impact estimation" })
                    .option("sizes", { type: "string", describe: "Optional path to sizes.json for impact estimation" })
                    .option("json", { type: "boolean", default: false })
                    .option("limit", { type: "number", describe: "Keep only top-N suggestions (by estimated KB)" })
                    .option("diff", { type: "boolean", default: false, describe: "When --dry, output unified diffs (no writes)" })
                    .option("diff-out", { type: "string", default: ".nectar/diff.patch", describe: "Path to write the unified diff" })
                    .option("only", { type: "string", describe: "Comma-separated suggestion IDs to include (from plan or current run)" })
                    .option("except", { type: "string", describe: "Comma-separated suggestion IDs to EXCLUDE" })
                    .option("typecheck", {
                        type: "boolean",
                        default: true,
                        describe: "Run tsc gate after edits (use --no-typecheck to skip)",
                    }),
            async (argv) => {
                const cfg = await loadConfig();
                const outDir = argv.out as string;

                let suggestions: any[] = [];

                if (argv.plan) {
                    const plan = await readPlan(argv.plan as string);
                    suggestions = Array.isArray(plan.items) ? plan.items : [];

                    // only
                    if (typeof argv.only === "string" && argv.only.trim()) {
                        const ids = argv.only.split(",").map(s => s.trim());
                        const idOf = (s: any) => s?.id ?? suggestionId(s);
                        suggestions = suggestions.filter(s => ids.includes(idOf(s)));
                        if (!suggestions.length) console.log(pc.yellow("No plan items matched --only IDs."));
                    }

                    // except
                    if (typeof argv.except === "string" && argv.except.trim()) {
                        const ids = argv.except.split(",").map(s => s.trim());
                        const idOf = (s: any) => s?.id ?? suggestionId(s);
                        suggestions = suggestions.filter(s => !ids.includes(idOf(s)));
                        if (!suggestions.length) console.log(pc.yellow("All plan items excluded by --except."));
                    }
                } else {
                    // discovery
                    const rules = cfg.rules || {};
                    const allowStar = rules.STAR_IMPORT_SLIMMING !== false;
                    const allowDyn = rules.DYNAMIC_HEAVY_DEP !== false;

                    const star = allowStar ? await suggestStarImportSlimming(process.cwd(), cfg) : [];
                    const dyn = allowDyn ? await suggestDynamicHeavyDep(process.cwd(), cfg) : [];

                    let discovered = [...star, ...dyn];
                    if (argv.rule) discovered = discovered.filter((s) => s.kind === argv.rule);

                    const snap = await readBundleSnapshot(process.cwd(), argv.fixture as string | undefined, argv.sizes as string | undefined);
                    const minKB = Number(cfg.thresholds?.minEstimatedKB ?? 0);

                    type RankedWithId = (ReturnType<typeof estimateImpact>[number]) & { id: string };
                    let ranked: RankedWithId[] = estimateImpact(snap, discovered)
                        .filter(s => (Number(s.estimatedKB) || 0) >= minKB)
                        .sort((a, b) => b.estimatedKB - a.estimatedKB)
                        .map((s) => ({ ...s, id: suggestionId(s) }));

                    // only
                    if (typeof argv.only === "string" && argv.only.trim()) {
                        const ids = argv.only.split(",").map((s) => s.trim()).filter(Boolean);
                        ranked = ranked.filter((r) => ids.includes(r.id));
                        if (!ranked.length) console.log(pc.yellow("No suggestions matched --only IDs."));
                    }

                    // except
                    if (typeof argv.except === "string" && argv.except.trim()) {
                        const ids = argv.except.split(",").map((s) => s.trim()).filter(Boolean);
                        ranked = ranked.filter((r) => !ids.includes(r.id));
                        if (!ranked.length) console.log(pc.yellow("All suggestions excluded by --except."));
                    }

                    if (typeof argv.limit === "number" && argv.limit > 0) ranked = ranked.slice(0, argv.limit);

                    // assign before any early returns
                    suggestions = ranked;

                    const planPath = await writePlan(ranked, outDir);
                    if (!argv.json) console.log(pc.green(`Wrote plan: ${planPath}`));

                    if (argv.json && !argv.diff && !argv.apply) {
                        console.log(JSON.stringify({ plan: ranked }, null, 2));
                        return;
                    }

                    if (!argv.json) {
                        console.log(pc.cyan("\nTop suggestions by estimated KB:"));
                        for (const s of ranked.slice(0, 10)) {
                            const tag = s.kind === "STAR_IMPORT_SLIMMING" ? s.data.lib : s.data.from;
                            console.log(`  - ${s.kind} ${pc.bold(tag)} ~${s.estimatedKB} KB  @ ${s.file}  [${s.id}]`);
                        }
                    }
                }

                // if dry diff requested, generate and exit before applying
                if (argv.diff && (argv.dry && !argv.apply)) {
                    const starList = suggestions.filter((s) => s.kind === "STAR_IMPORT_SLIMMING");
                    const dynList = suggestions.filter((s) => s.kind === "DYNAMIC_HEAVY_DEP");

                    const [starDiffs, dynDiffs] = await Promise.all([
                        previewStarImportSlimming(starList),
                        previewDynamicHeavyDep(dynList),
                    ]);

                    const chunks = [...starDiffs, ...dynDiffs].map((d) => d.diff);
                    const patch = chunks.join("\n");

                    const outPath = path.resolve(process.cwd(), argv["diff-out"] as string);
                    await fs.mkdir(path.dirname(outPath), { recursive: true });
                    await fs.writeFile(outPath, patch, "utf8");

                    console.log(pc.green(`Wrote dry diff: ${outPath}`));
                    if (argv.json) {
                        console.log(JSON.stringify({ plan: suggestions, diffOut: outPath }, null, 2));
                    }
                    return;
                }

                if ((!suggestions || suggestions.length === 0) && (argv.diff || argv.apply)) {
                    console.log(pc.yellow("No suggestions available for this operation."));
                    return;
                }

                // apply or nah
                const dry = argv.apply ? false : argv.dry;
                if (dry) return;

                // transactional apply over the selected suggestions
                const starToApply = suggestions.filter((s) => s.kind === "STAR_IMPORT_SLIMMING");
                const dynToApply = suggestions.filter((s) => s.kind === "DYNAMIC_HEAVY_DEP");

                const all: ApplyResult[] = [];
                if (starToApply.length) {
                    console.log(pc.cyan(`\nApplying STAR_IMPORT_SLIMMING (${starToApply.length})…`));
                    all.push(...(await applyStarImportSlimming(starToApply)));
                }
                if (dynToApply.length) {
                    console.log(pc.cyan(`\nApplying DYNAMIC_HEAVY_DEP (${dynToApply.length})…`));
                    all.push(...(await applyDynamicHeavyDep(dynToApply)));
                }

                const applied = all.filter((r) => r.applied && r.backupsPath);
                if (applied.length === 0) {
                    console.log(pc.yellow("No file edits were applied; nothing to typecheck."));
                    return;
                }

                if (argv.typecheck === false) {
                    console.log(pc.yellow("Skipping typecheck by request (--no-typecheck). Edits kept."));
                    return;
                }

                console.log(pc.cyan("\nRunning typecheck (tsc --noEmit)…"));
                const tc = await runTypecheck();
                if (!tc.ok) {
                    console.log(pc.red("Typecheck failed — reverting all edits."));
                    await restoreBackups(applied);
                    console.log(pc.yellow("All edits reverted."));
                    console.log(tc.output.slice(0, 2000));
                    return;
                }
                console.log(pc.green("Typecheck passed. Edits kept."));
            }
        )
        .command(
            "init",
            "scan node_modules and propose nectar.config.json",
            (y) => y
                .option("top", { type: "number", default: 15, describe: "Keep top-N heaviest deps" })
                .option("min", { type: "number", default: 80, describe: "Min KB per package to include" })
                .option("depth", { type: "number", default: 2, describe: "How deep to scan inside each package" })
                .option("ignore", { type: "array", default: [], describe: "Package globs to ignore (repeatable)" })
                .option("write", { type: "boolean", default: false, describe: "Write nectar.config.json" })
                .option("json", { type: "boolean", default: false, describe: "Print JSON to stdout" }),
            async (argv) => {
                const cfg = await proposeConfig({
                    top: argv.top as number,
                    sizeThresholdKB: argv.min as number,
                    depth: argv.depth as number,
                    ignore: (argv.ignore as string[]) ?? []
                });

                if (argv.json || !argv.write) {
                    console.log(JSON.stringify(cfg, null, 2));
                }
                if (argv.write) {
                    const file = path.join(process.cwd(), "nectar.config.json");
                    await fs.writeFile(file, JSON.stringify(cfg, null, 2));
                    console.log(pc.green(`Wrote ${file}`));
                }
            }
        )
        .command(
            "measure",
            "attach Lighthouse to a running app and record medians",
            (y) => y
                .option("base", { type: "string", demandOption: true, describe: "Base URL, e.g. http://localhost:3000" })
                .option("routes", { type: "string", demandOption: true, describe: "JSON array or comma-separated routes: \"[/, /product/1]\" or \"/, /product/1\"" })
                .option("runs", { type: "number", default: 3, describe: "Number of runs per route" })
                .option("form-factor", { type: "string", choices: ["desktop", "mobile"] as const, default: "desktop" })
                .option("chrome-path", { type: "string", describe: "Path to Chrome/Chromium; or set CHROME_PATH" })
                .option("out", { type: "string", default: ".nectar", describe: "Output directory for metrics.json" })
                .option("json", { type: "boolean", default: false, describe: "Print metrics JSON to stdout as well" }),
            async (argv) => {
                const routes = parseRoutes(argv.routes as string);
                if (routes.length === 0) {
                    console.log("No routes parsed. Provide JSON array or comma-separated list.");
                    process.exit(2);
                }
                try {
                    const { file, summaries } = await measureAttach({
                        base: argv.base as string,
                        routes,
                        runs: argv.runs as number,
                        formFactor: argv["form-factor"] as "desktop" | "mobile",
                        chromePath: argv["chrome-path"] as string | undefined,
                        outDir: argv.out as string,
                        logLevel: "error"
                    });
                    console.log(`Wrote ${file}`);
                    if (argv.json) {
                        console.log(JSON.stringify({ base: argv.base, summaries }, null, 2));
                    } else {
                        // pretty console summary
                        for (const s of summaries) {
                            const m = s.median;
                            console.log(
                                `[${s.route}] LCP ${fmt(m.lcpMs)}ms | FCP ${fmt(m.fcpMs)}ms | TBT ${fmt(m.tbtMs)}ms | CLS ${m.cls ?? "—"} | Score ${m.perfScore ?? "—"}`
                            );
                        }
                    }
                } catch (e: any) {
                    if (/Cannot find module 'lighthouse'|chrome-launcher/.test(String(e))) {
                        console.error("Install dev deps first: `pnpm add -D lighthouse chrome-launcher`");
                    }
                    throw e;
                }
            }
        )
        .command(
            "validate",
            "validate nectar.config.json",
            (y) => y.option("json", { type: "boolean", default: false }),
            async (argv) => {
                const res = await validateConfigFile("nectar.config.json");
                if (argv.json) {
                    console.log(JSON.stringify(res, null, 2));
                    if (!res.ok) process.exitCode = 1;
                    return;
                }
                if (res.ok) {
                    console.log("nectar.config.json looks good.");
                } else {
                    console.log("Issues in nectar.config.json:");
                    for (const i of res.issues) console.log(` - [${i.path}] ${i.message}`);
                    process.exitCode = 1;
                }
            }
        )
        .command(
            "restore",
            "restore the most recent backup from .nectar/backups",
            (y) => y,
            async () => {
                const res = await restoreLatestBackup();
                if (!res.ok) {
                    console.log(pc.red(`Restore failed: ${res.reason}`));
                    process.exitCode = 1;
                    return;
                }
                console.log(pc.green(`Restored ${res.restored} file(s) from ${res.folder}`));
            }
        )
        .command(
            "render",
            "render plan artifacts to markdown or json (pure, no side effects)",
            y => y
                .option("format", { type: "string", choices: ["comment", "summary", "json"], default: "comment" })
                .option("plan", { type: "string", default: ".nectar/plan.json" })
                .option("diff", { type: "string", describe: "Path to unified diff (e.g., .nectar/diff.patch)" })
                .option("report", { type: "string", describe: "Path to report markdown (e.g., .nectar/report.md)" })
                .option("only", { type: "string", describe: "IDs to include (comma-separated)" })
                .option("except", { type: "string", describe: "IDs to exclude (comma-separated)" })
                .option("out", { type: "string", describe: "Write to file instead of stdout" })
                .option("fail-if-total-kb", { type: "number", describe: "Exit non-zero if total estimated KB exceeds this" })
                .option("fail-if-count", { type: "number", describe: "Exit non-zero if suggestion count exceeds this" })
                .option("json", { type: "boolean", default: false, describe: "Force JSON output for any format (machine-readable)" }),
            async (argv) => {
                const plan = await loadPlan(argv.plan as string);
                let items = filterItems(plan.items, argv.only as string | undefined, argv.except as string | undefined);

                // thresholds (evaluate before rendering)
                const { totalKB, count } = totals(items);
                let thresholdFailed = false;
                if (typeof argv["fail-if-total-kb"] === "number" && totalKB > argv["fail-if-total-kb"]) thresholdFailed = true;
                if (typeof argv["fail-if-count"] === "number" && count > argv["fail-if-count"]) thresholdFailed = true;

                // content
                const diff = await loadTextIfExists(argv.diff as string | undefined);
                const report = await loadTextIfExists(argv.report as string | undefined);

                const fmt = argv.format as string;
                let outStr = "";
                let outJSON: any = null;

                if (argv.json || fmt === "json") {
                    outJSON = renderJSON(items);
                } else if (fmt === "summary") {
                    outStr = renderSummaryMD(items);
                } else {
                    outStr = renderCommentMD(items, report, diff);
                }

                // output
                if (argv.out) {
                    const p = path.resolve(process.cwd(), argv.out as string);
                    await fs.mkdir(path.dirname(p), { recursive: true });
                    await fs.writeFile(p, outJSON ? JSON.stringify(outJSON, null, 2) : outStr, "utf8");
                    console.log(pc.green(`Wrote ${fmt} to ${p}`));
                } else {
                    if (outJSON) console.log(JSON.stringify(outJSON, null, 2));
                    else console.log(outStr);
                }

                if (thresholdFailed) process.exitCode = 1;
            }
        )
        .demandCommand(1)
        .strict()
        .help()
        .parse();
}

// helpers
function parseRoutes(raw: string): string[] {
    try {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) return arr.map(String);
    } catch { /* not JSON */ }
    return raw.split(",").map(s => s.trim()).filter(Boolean);
}

function fmt(n: number | null) { return n == null ? "—" : n.toString(); }

