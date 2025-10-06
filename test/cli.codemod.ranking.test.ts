import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { createRequire } from "node:module";
const requireFromHere = createRequire(import.meta.url);

function runCLI(cwd: string, args: string[]) {
    const repoRoot = path.resolve(__dirname, "..");
    const cli = path.join(repoRoot, "src", "index.ts");

    // resolve tsx's esm loader from repo's node_modules
    let tsxLoader: string;
    try {
        tsxLoader = requireFromHere.resolve("tsx/esm");
    } catch {
        tsxLoader = requireFromHere.resolve("tsx");
    }

    const res = spawnSync(
        "node",
        ["--import", tsxLoader, cli, ...args],
        {
            cwd,
            encoding: "utf8",
            env: {
                ...process.env,
                FORCE_COLOR: "0",
                NODE_PATH: path.join(repoRoot, "node_modules"),
            },
        }
    );

    if (res.status !== 0 && res.status !== null) {
        throw new Error(`CLI failed: ${res.stderr || res.stdout}`);
    }
    return (res.stdout || "") + (res.stderr || "");
}

async function makeTempProject() {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "nectar-cli-"));
    // minimal nectar config
    await fs.writeFile(path.join(dir, "nectar.config.json"), JSON.stringify({
        heavyDeps: ["date-fns", "chart.js"],
        dynamicAllowlist: ["Chart"]
    }, null, 2));

    // source files
    const srcDir = path.join(dir, "src");
    await fs.mkdir(path.join(srcDir, "components"), { recursive: true });
    await fs.mkdir(path.join(srcDir, "pages"), { recursive: true });
    await fs.writeFile(path.join(srcDir, "pages", "DatePage.tsx"), `
    import * as dateFns from 'date-fns';
    export function DatePage(){
      const d = dateFns.parseISO('2025-10-01');
      return <div>{dateFns.format(d, 'yyyy-MM-dd')}</div>;
    }
  `, "utf8");
    await fs.writeFile(path.join(srcDir, "components", "Chart.tsx"), `
    // matches dynamicAllowlist hint
    import Chart from 'chart.js';
    export function ChartCard(){ return <div>{String(Chart)}</div>; }
  `, "utf8");

    // manifest + sizes fixtures for impact estimator
    const manDir = path.join(dir, "manifest");
    await fs.mkdir(manDir, { recursive: true });
    await fs.writeFile(path.join(manDir, "build-manifest.json"), JSON.stringify({
        pages: {
            "/": [
                "static/chunks/pages/index-AAA.js",
                "static/chunks/vendors-date-fns-BBB.js"
            ],
            "/product/[id]": [
                "static/chunks/pages/product-id-CCC.js",
                "static/chunks/vendors-chart.js-DDD.js"
            ]
        }
    }, null, 2));
    await fs.writeFile(path.join(manDir, "sizes.json"), JSON.stringify({
        "static/chunks/pages/index-AAA.js": 120_000,
        "static/chunks/vendors-date-fns-BBB.js": 80_000,
        "static/chunks/pages/product-id-CCC.js": 200_000,
        "static/chunks/vendors-chart.js-DDD.js": 150_000
    }, null, 2));

    // tsconfig for tsc compatibility
    await fs.writeFile(path.join(dir, "tsconfig.json"), JSON.stringify({ compilerOptions: { jsx: "react-jsx" } }));

    return {
        dir,
        manifest: path.join(manDir, "build-manifest.json"),
        sizes: path.join(manDir, "sizes.json")
    };
}

function parseJsonFromOutput(out: string) {
    const idx = out.indexOf("{");
    if (idx < 0) throw new Error(`No JSON in output:\n${out}`);
    const json = out.slice(idx);
    return JSON.parse(json);
}

describe("CLI codemod ranking & rule filter", () => {
    it("ranks suggestions by estimatedKB (chart.js > date-fns) and writes plan.json", async () => {
        const { dir, manifest, sizes } = await makeTempProject();

        const out = runCLI(dir, [
            "codemod",
            "--json",
            "--fixture", manifest,
            "--sizes", sizes
        ]);

        // stdout contains plan json
        const parsed = parseJsonFromOutput(out);
        expect(Array.isArray(parsed.plan)).toBe(true);
        expect(parsed.plan.length).toBeGreaterThanOrEqual(2);

        // first item should be chart.js (150KB) > date-fns (80KB)
        const first = parsed.plan[0];
        const second = parsed.plan[1];
        expect(["DYNAMIC_HEAVY_DEP", "STAR_IMPORT_SLIMMING"]).toContain(first.kind);
        expect(["DYNAMIC_HEAVY_DEP", "STAR_IMPORT_SLIMMING"]).toContain(second.kind);
        const tagFirst = first.kind === "STAR_IMPORT_SLIMMING" ? first.data.lib : first.data.from;
        const tagSecond = second.kind === "STAR_IMPORT_SLIMMING" ? second.data.lib : second.data.from;

        expect(tagFirst).toBe("chart.js");
        expect(tagSecond).toBe("date-fns");
        expect(first.estimatedKB).toBeGreaterThan(second.estimatedKB);

        // plan.json exists in .nectar
        const planPath = path.join(dir, ".nectar", "plan.json");
        const planRaw = await fs.readFile(planPath, "utf8");
        const plan = JSON.parse(planRaw);
        expect(plan.items.length).toBeGreaterThanOrEqual(2);
    });

    it("respects --rule filter (only STAR_IMPORT_SLIMMING)", async () => {
        const { dir, manifest, sizes } = await makeTempProject();

        const out = runCLI(dir, [
            "codemod",
            "--json",
            "--rule", "STAR_IMPORT_SLIMMING",
            "--fixture", manifest,
            "--sizes", sizes
        ]);
        const parsed = parseJsonFromOutput(out);
        expect(parsed.plan.length).toBeGreaterThan(0);
        for (const item of parsed.plan) {
            expect(item.kind).toBe("STAR_IMPORT_SLIMMING");
        }
    });
});
