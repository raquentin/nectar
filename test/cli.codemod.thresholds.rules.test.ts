import { describe, it, expect } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
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
function parse(out: string) { const s = out.indexOf("{"), e = out.lastIndexOf("}"); return JSON.parse(out.slice(s, e + 1)); }

async function setupProject(opts: { chartKB: number; dfKB: number }) {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "nectar-rules-"));
    await fs.writeFile(path.join(dir, "nectar.config.json"), JSON.stringify({
        heavyDeps: ["date-fns", "chart.js"],
        dynamicAllowlist: ["Chart"],
        rules: { STAR_IMPORT_SLIMMING: true, DYNAMIC_HEAVY_DEP: true },
        thresholds: { minEstimatedKB: 0 }
    }, null, 2));
    const src = path.join(dir, "src"); await fs.mkdir(path.join(src, "pages"), { recursive: true });
    await fs.mkdir(path.join(src, "components"), { recursive: true });
    await fs.writeFile(path.join(src, "pages", "Date.tsx"), `import * as d from 'date-fns'; export default d.format(new Date(),'y')`);
    await fs.writeFile(path.join(src, "components", "Chart.tsx"), `import Chart from 'chart.js'; export const C=()=>String(Chart)`);
    const man = path.join(dir, "manifest"); await fs.mkdir(man, { recursive: true });
    await fs.writeFile(path.join(man, "build-manifest.json"), JSON.stringify({
        pages: {
            "/": ["static/chunks/vendors-date-fns.js"],
            "/chart": ["static/chunks/vendors-chart.js"]
        }
    }));
    await fs.writeFile(path.join(man, "sizes.json"), JSON.stringify({
        "static/chunks/vendors-date-fns.js": opts.dfKB * 1000,
        "static/chunks/vendors-chart.js": opts.chartKB * 1000
    }));
    return { dir, manifest: path.join(man, "build-manifest.json"), sizes: path.join(man, "sizes.json") };
}

describe("codemod respects rules + minEstimatedKB", () => {
    it("disables a rule via config", async () => {
        const { dir, manifest, sizes } = await setupProject({ chartKB: 150, dfKB: 80 });
        // disable dynamic rule
        await fs.writeFile(path.join(dir, "nectar.config.json"), JSON.stringify({
            heavyDeps: ["date-fns", "chart.js"],
            dynamicAllowlist: ["Chart"],
            rules: { STAR_IMPORT_SLIMMING: true, DYNAMIC_HEAVY_DEP: false },
            thresholds: { minEstimatedKB: 0 }
        }));
        const out = runCLI(dir, ["codemod", "--json", "--fixture", manifest, "--sizes", sizes]);
        const { plan } = parse(out);
        const hasDyn = plan.some((p: any) => p.kind === "DYNAMIC_HEAVY_DEP");
        const hasStar = plan.some((p: any) => p.kind === "STAR_IMPORT_SLIMMING");
        expect(hasDyn).toBe(false);
        expect(hasStar).toBe(true);
    });

    it("filters by minEstimatedKB", async () => {
        const { dir, manifest, sizes } = await setupProject({ chartKB: 15, dfKB: 8 });
        await fs.writeFile(path.join(dir, "nectar.config.json"), JSON.stringify({
            heavyDeps: ["date-fns", "chart.js"],
            dynamicAllowlist: ["Chart"],
            rules: { STAR_IMPORT_SLIMMING: true, DYNAMIC_HEAVY_DEP: true },
            thresholds: { minEstimatedKB: 10 }
        }));
        const out = runCLI(dir, ["codemod", "--json", "--fixture", manifest, "--sizes", sizes]);
        const { plan } = parse(out);
        // chart (~15 KB) remains; date-fns (~8 KB) filtered out
        const tags = plan.map((p: any) => p.kind === "STAR_IMPORT_SLIMMING" ? p.data.lib : p.data.from);
        expect(tags).toContain("chart.js");
        expect(tags).not.toContain("date-fns");
    });
});
