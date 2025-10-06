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

describe("render comment", () => {
    it("produces markdown with summary table and ids", async () => {
        const dir = await fs.mkdtemp(path.join(os.tmpdir(), "nectar-render-"));
        const plan = {
            createdAt: new Date().toISOString(),
            items: [
                { kind: "DYNAMIC_HEAVY_DEP", file: "src/components/Chart.tsx", data: { from: "chart.js", localName: "Chart" }, estimatedKB: 150 },
                { kind: "STAR_IMPORT_SLIMMING", file: "src/pages/Date.tsx", data: { lib: "date-fns", ns: "d", usedMembers: ["format", "parseISO"] }, estimatedKB: 80 }
            ]
        };
        await fs.mkdir(path.join(dir, ".nectar"), { recursive: true });
        await fs.writeFile(path.join(dir, ".nectar/plan.json"), JSON.stringify(plan, null, 2));

        const out = runCLI(dir, ["render", "--format", "comment", "--plan", ".nectar/plan.json"]);
        expect(out).toMatch(/# 🌺 nectar suggestions/);
        expect(out).toMatch(/\| ID \| Rule \| Target \| File \| Est\. KB \|/);
        expect(out).toMatch(/DYNAMIC_HEAVY_DEP/);
        expect(out).toMatch(/STAR_IMPORT_SLIMMING/);
        // ids present in backticks
        expect(out).toMatch(/\|\`[a-f0-9]{12}\`\|/);
    });
});
