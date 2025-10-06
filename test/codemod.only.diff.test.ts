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

async function makeTempProject() {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "nectar-only-"));
    await fs.writeFile(path.join(dir, "nectar.config.json"), JSON.stringify({
        heavyDeps: ["date-fns", "chart.js"], dynamicAllowlist: ["Chart"]
    }, null, 2));
    const src = path.join(dir, "src");
    await fs.mkdir(path.join(src, "pages"), { recursive: true });
    await fs.mkdir(path.join(src, "components"), { recursive: true });
    await fs.writeFile(path.join(src, "pages", "DatePage.tsx"), `
    import * as dateFns from 'date-fns';
    export default function Pg(){ const d=dateFns.parseISO('2025-10-01'); return <div>{dateFns.format(d,'y')}</div> }
  `);
    await fs.writeFile(path.join(src, "components", "Chart.tsx"), `
    import Chart from 'chart.js'; export const C=()=> <div>{String(Chart)}</div>;
  `);
    const man = path.join(dir, "manifest"); await fs.mkdir(man, { recursive: true });
    await fs.writeFile(path.join(man, "build-manifest.json"), JSON.stringify({
        pages: {
            "/": ["static/chunks/pages/index.js", "static/chunks/vendors-date-fns-BBB.js"],
            "/chart": ["static/chunks/pages/chart.js", "static/chunks/vendors-chart.js-DDD.js"]
        }
    }));
    await fs.writeFile(path.join(man, "sizes.json"), JSON.stringify({
        "static/chunks/pages/index.js": 100_000,
        "static/chunks/pages/chart.js": 120_000,
        "static/chunks/vendors-date-fns-BBB.js": 80_000,
        "static/chunks/vendors-chart.js-DDD.js": 150_000
    }));
    return { dir, manifest: path.join(man, "build-manifest.json"), sizes: path.join(man, "sizes.json") };
}

describe("codemod --only with --diff", () => {
    it("previews only the requested ID", async () => {
        const { dir, manifest, sizes } = await makeTempProject();

        // get plan and ids
        const out1 = runCLI(dir, ["codemod", "--json", "--fixture", manifest, "--sizes", sizes]);
        const parsed = parseJSON(out1);
        const plan = parsed.plan;
        const chart = plan.find((p: any) => (p.kind === "DYNAMIC_HEAVY_DEP"))!;
        const date = plan.find((p: any) => (p.kind === "STAR_IMPORT_SLIMMING"))!;
        expect(chart?.id).toBeTruthy();
        expect(date?.id).toBeTruthy();

        const diffPath = path.join(dir, ".nectar", "diff.patch");
        const out2 = runCLI(dir, [
            "codemod",
            "--diff",
            "--only", chart.id,
            "--fixture", manifest,
            "--sizes", sizes,
            "--diff-out", diffPath,
            "--json"
        ]);
        // patch includes chart file but not datepage
        const patch = await fs.readFile(diffPath, "utf8");
        expect(patch).toMatch(/--- a\/src\/components\/Chart\.tsx/);
        expect(patch).not.toMatch(/--- a\/src\/pages\/DatePage\.tsx/);
    });
});
