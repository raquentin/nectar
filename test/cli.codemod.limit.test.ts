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
        cwd, encoding: "utf8", env: { ...process.env, FORCE_COLOR: "0", NODE_PATH: path.join(repoRoot, "node_modules") }
    });
    if (res.status !== 0 && res.status !== null) throw new Error(`CLI failed: ${res.stderr || res.stdout}`);
    return (res.stdout || "") + (res.stderr || "");
}

async function makeTempProject() {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "nectar-limit-"));
    await fs.writeFile(path.join(dir, "nectar.config.json"), JSON.stringify({
        heavyDeps: ["date-fns", "chart.js"],
        dynamicAllowlist: ["Chart"]
    }, null, 2));
    const src = path.join(dir, "src");
    await fs.mkdir(path.join(src, "components"), { recursive: true });
    await fs.mkdir(path.join(src, "pages"), { recursive: true });
    await fs.writeFile(path.join(src, "pages", "DatePage.tsx"), `
    import * as dateFns from 'date-fns';
    export default function Pg(){ const d=dateFns.parseISO('2025-10-01'); return <div>{dateFns.format(d,'y')}</div>; }
  `);
    await fs.writeFile(path.join(src, "components", "Chart.tsx"), `
    import Chart from 'chart.js'; export const C=()=> <div>{String(Chart)}</div>;
  `);
    const man = path.join(dir, "manifest"); await fs.mkdir(man, { recursive: true });
    await fs.writeFile(path.join(man, "build-manifest.json"), JSON.stringify({
        pages: { "/": ["static/chunks/vendors-date-fns-BBB.js"], "/p": ["static/chunks/vendors-chart.js-DDD.js"] }
    }, null, 2));
    await fs.writeFile(path.join(man, "sizes.json"), JSON.stringify({
        "static/chunks/vendors-date-fns-BBB.js": 80_000,
        "static/chunks/vendors-chart.js-DDD.js": 150_000
    }, null, 2));
    return { dir, manifest: path.join(man, "build-manifest.json"), sizes: path.join(man, "sizes.json") };
}

function parseJSON(out: string) {
    const i = out.indexOf("{"); if (i < 0) throw new Error("No JSON in output");
    return JSON.parse(out.slice(i));
}

describe("codemod --limit", () => {
    it("limits the plan to top-N items", async () => {
        const { dir, manifest, sizes } = await makeTempProject();
        const out = runCLI(dir, ["codemod", "--json", "--limit", "1", "--fixture", manifest, "--sizes", sizes]);
        const parsed = parseJSON(out);
        expect(parsed.plan.length).toBe(1);
        // keep the larger chart.js suggestion
        const tag = parsed.plan[0].kind === "STAR_IMPORT_SLIMMING" ? parsed.plan[0].data.lib : parsed.plan[0].data.from;
        expect(tag).toBe("chart.js");
        // plan.json persisted with 1 item
        const planPath = path.join(dir, ".nectar", "plan.json");
        const planRaw = await fs.readFile(planPath, "utf8");
        const plan = JSON.parse(planRaw);
        expect(plan.items.length).toBe(1);
    });
});
