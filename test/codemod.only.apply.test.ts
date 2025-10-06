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
function parseJSON(out: string) { const i = out.indexOf("{"); return JSON.parse(out.slice(i)); }

async function setupProject() {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "nectar-only-apply-"));
    await fs.writeFile(path.join(dir, "tsconfig.json"), JSON.stringify({ compilerOptions: { jsx: "react-jsx" } }));
    await fs.writeFile(path.join(dir, "nectar.config.json"), JSON.stringify({
        heavyDeps: ["date-fns", "chart.js"], dynamicAllowlist: ["Chart"]
    }));
    const src = path.join(dir, "src");
    await fs.mkdir(path.join(src, "pages"), { recursive: true });
    await fs.mkdir(path.join(src, "components"), { recursive: true });
    const dateFile = path.join(src, "pages", "DatePage.tsx");
    const chartFile = path.join(src, "components", "Chart.tsx");
    await fs.writeFile(dateFile, `import * as dateFns from 'date-fns'; export default function Pg(){ const d=dateFns.parseISO('2025-10-01'); return <div>{dateFns.format(d,'y')}</div> }`);
    await fs.writeFile(chartFile, `import Chart from 'chart.js'; export const C=()=> <div>{String(Chart)}</div>;`);
    const man = path.join(dir, "manifest"); await fs.mkdir(man, { recursive: true });
    await fs.writeFile(path.join(man, "build-manifest.json"), JSON.stringify({
        pages: { "/": ["static/chunks/vendors-date-fns-BBB.js"], "/chart": ["static/chunks/vendors-chart.js-DDD.js"] }
    }));
    await fs.writeFile(path.join(man, "sizes.json"), JSON.stringify({
        "static/chunks/vendors-date-fns-BBB.js": 80_000,
        "static/chunks/vendors-chart.js-DDD.js": 150_000
    }));
    return { dir, dateFile, chartFile, manifest: path.join(man, "build-manifest.json"), sizes: path.join(man, "sizes.json") };
}

describe("codemod --apply with --only IDs", () => {
    it("applies only the selected suggestion", async () => {
        const { dir, dateFile, chartFile, manifest, sizes } = await setupProject();

        // discover ids
        const out = runCLI(dir, ["codemod", "--json", "--fixture", manifest, "--sizes", sizes]);
        const { plan } = parseJSON(out);
        const chart = plan.find((p: any) => p.kind === "DYNAMIC_HEAVY_DEP")!;
        const date = plan.find((p: any) => p.kind === "STAR_IMPORT_SLIMMING")!;
        expect(chart.id && date.id).toBeTruthy();

        const beforeDate = await fs.readFile(dateFile, "utf8");
        const beforeChart = await fs.readFile(chartFile, "utf8");

        // apply only chart dynamic suggestion
        runCLI(dir, ["codemod", "--apply", "--no-typecheck", "--only", chart.id, "--fixture", manifest, "--sizes", sizes]);

        const afterDate = await fs.readFile(dateFile, "utf8");
        const afterChart = await fs.readFile(chartFile, "utf8");

        // date page unchanged; chart modified
        expect(afterDate).toBe(beforeDate);
        expect(afterChart).toMatch(/import dynamic from 'next\/dynamic';/);
        expect(afterChart).toMatch(/const Chart = dynamic\(/);
    });
});
