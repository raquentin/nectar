import { describe, it, expect } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
const requireFromHere = createRequire(import.meta.url);

function runCLIWithStatus(cwd: string, args: string[]) {
    const repoRoot = path.resolve(__dirname, "..");
    const cli = path.join(repoRoot, "src", "index.ts");
    let tsxLoader: string;
    try { tsxLoader = requireFromHere.resolve("tsx/esm"); } catch { tsxLoader = requireFromHere.resolve("tsx"); }
    return spawnSync("node", ["--import", tsxLoader, cli, ...args], {
        cwd, encoding: "utf8",
        env: { ...process.env, FORCE_COLOR: "0", NODE_PATH: path.join(repoRoot, "node_modules") }
    });
}

describe("render thresholds", () => {
    it("exits non-zero when total KB exceeds limit", async () => {
        const dir = await fs.mkdtemp(path.join(os.tmpdir(), "nectar-render-th-"));
        await fs.mkdir(path.join(dir, ".nectar"), { recursive: true });
        await fs.writeFile(path.join(dir, ".nectar/plan.json"), JSON.stringify({
            items: [
                { kind: "DYNAMIC_HEAVY_DEP", file: "a.tsx", data: { from: "chart.js", localName: "Chart" }, estimatedKB: 120 },
                { kind: "STAR_IMPORT_SLIMMING", file: "b.tsx", data: { lib: "date-fns", ns: "d", usedMembers: ["format"] }, estimatedKB: 40 }
            ]
        }, null, 2));

        const res = runCLIWithStatus(dir, ["render", "--format", "summary", "--fail-if-total-kb", "100"]);
        expect(res.status).toBe(1);
        const out = (res.stdout || "") + (res.stderr || "");
        expect(out).toMatch(/Suggestions Summary/);
    });

    it("passes when under limits", async () => {
        const dir = await fs.mkdtemp(path.join(os.tmpdir(), "nectar-render-th2-"));
        await fs.mkdir(path.join(dir, ".nectar"), { recursive: true });
        await fs.writeFile(path.join(dir, ".nectar/plan.json"), JSON.stringify({
            items: [{ kind: "STAR_IMPORT_SLIMMING", file: "b.tsx", data: { lib: "date-fns", ns: "d", usedMembers: ["format"] }, estimatedKB: 10 }]
        }, null, 2));
        const res = runCLIWithStatus(dir, ["render", "--format", "summary", "--fail-if-total-kb", "100", "--fail-if-count", "2"]);
        expect(res.status).toBe(0);
    });
});
