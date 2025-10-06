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
    let tsxLoader: string;
    try { tsxLoader = requireFromHere.resolve("tsx/esm"); } catch { tsxLoader = requireFromHere.resolve("tsx"); }
    const res = spawnSync("node", ["--import", tsxLoader, cli, ...args], {
        cwd, encoding: "utf8",
        env: { ...process.env, FORCE_COLOR: "0", NODE_PATH: path.join(repoRoot, "node_modules") }
    });
    if (res.status !== 0 && res.status !== null) throw new Error(`CLI failed: ${res.stderr || res.stdout}`);
    return (res.stdout || "") + (res.stderr || "");
}

async function makeTempProject() {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "nectar-diff-"));
    await fs.writeFile(path.join(dir, "nectar.config.json"), JSON.stringify({
        heavyDeps: ["date-fns", "chart.js"], dynamicAllowlist: ["Chart"]
    }, null, 2));

    const src = path.join(dir, "src");
    await fs.mkdir(path.join(src, "pages"), { recursive: true });
    await fs.mkdir(path.join(src, "components"), { recursive: true });

    const dateFile = path.join(src, "pages", "DatePage.tsx");
    const chartFile = path.join(src, "components", "Chart.tsx");

    await fs.writeFile(dateFile, `
    import * as dateFns from 'date-fns';
    export default function Pg(){ const d = dateFns.parseISO('2025-10-01'); return <div>{dateFns.format(d,'y')}</div> }
  `, "utf8");
    await fs.writeFile(chartFile, `
    import Chart from 'chart.js';
    export const C = () => <div>{String(Chart)}</div>;
  `, "utf8");

    const manDir = path.join(dir, "manifest");
    await fs.mkdir(manDir, { recursive: true });
    await fs.writeFile(path.join(manDir, "build-manifest.json"), JSON.stringify({
        pages: {
            "/": ["static/chunks/pages/index.js", "static/chunks/vendors-date-fns-BBB.js"],
            "/chart": ["static/chunks/pages/chart.js", "static/chunks/vendors-chart.js-DDD.js"]
        }
    }));
    await fs.writeFile(path.join(manDir, "sizes.json"), JSON.stringify({
        "static/chunks/pages/index.js": 100_000,
        "static/chunks/pages/chart.js": 120_000,
        "static/chunks/vendors-date-fns-BBB.js": 80_000,
        "static/chunks/vendors-chart.js-DDD.js": 150_000
    }));

    return { dir, dateFile, chartFile, manifest: path.join(manDir, "build-manifest.json"), sizes: path.join(manDir, "sizes.json") };
}

describe("codemod --dry --diff", () => {
    it("writes a unified diff without changing files", async () => {
        const { dir, dateFile, chartFile, manifest, sizes } = await makeTempProject();

        const beforeDate = await fs.readFile(dateFile, "utf8");
        const beforeChart = await fs.readFile(chartFile, "utf8");

        const diffPath = path.join(dir, ".nectar", "diff.patch");
        const out = runCLI(dir, [
            "codemod",
            "--diff",
            "--fixture", manifest,
            "--sizes", sizes,
            "--diff-out", diffPath
        ]);

        // files unchanged
        const afterDate = await fs.readFile(dateFile, "utf8");
        const afterChart = await fs.readFile(chartFile, "utf8");
        expect(afterDate).toBe(beforeDate);
        expect(afterChart).toBe(beforeChart);

        // diff file exists with expected hunks
        const patch = await fs.readFile(diffPath, "utf8");
        expect(patch).toMatch(/^--- a\/src\/pages\/DatePage\.tsx/m);
        const hasFormat = /\+ ?import (?:format|parseISO) from 'date-fns\/format'/.test(patch) ||
            /\+ ?import format from 'date-fns\/format'/.test(patch);
        const hasParse = /\+ ?import (?:parseISO|format) from 'date-fns\/parseISO'/.test(patch) ||
            /\+ ?import parseISO from 'date-fns\/parseISO'/.test(patch);
        expect(hasFormat).toBe(true);
        expect(hasParse).toBe(true);

        expect(patch).toMatch(/^--- a\/src\/components\/Chart\.tsx/m);
        expect(patch).toMatch(/\+ ?import dynamic from 'next\/dynamic';/);
        expect(patch).toMatch(/const Chart = dynamic\(\(\) => import\('chart\.js'\), \{ ssr: false \}\)/);
    });
});
