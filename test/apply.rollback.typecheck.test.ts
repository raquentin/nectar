import { describe, it, expect, vi } from "vitest";
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

async function setupProject() {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "nectar-rollback-"));
    await fs.writeFile(path.join(dir, "nectar.config.json"), JSON.stringify({
        heavyDeps: ["chart.js"], dynamicAllowlist: ["Chart"]
    }));
    const src = path.join(dir, "src"); await fs.mkdir(path.join(src, "components"), { recursive: true });
    const f = path.join(src, "components", "Chart.tsx");
    await fs.writeFile(f, `import Chart from 'chart.js'; export const C=()=> <div>{String(Chart)}</div>;`, "utf8");
    const man = path.join(dir, "manifest"); await fs.mkdir(man, { recursive: true });
    await fs.writeFile(path.join(man, "build-manifest.json"), JSON.stringify({ pages: { "/": ["static/chunks/vendors-chart.js-x.js"] } }));
    await fs.writeFile(path.join(man, "sizes.json"), JSON.stringify({ "static/chunks/vendors-chart.js-x.js": 150000 }));
    return { dir, file: f, manifest: path.join(man, "build-manifest.json"), sizes: path.join(man, "sizes.json") };
}

describe("codemod apply rolls back on typecheck failure", () => {
    it("file content remains as before when runTypecheck fails", async () => {
        const { dir, file, manifest, sizes } = await setupProject();

        // set env flag to trigger typecheck failure
        const mockLibDir = path.join(dir, "node_modules", "../src/lib");
        process.env.NECTAR_TEST_FORCE_TSC_FAIL = "1";

        const before = await fs.readFile(file, "utf8");
        runCLI(dir, ["codemod", "--apply", "--fixture", manifest, "--sizes", sizes]);
        const after = await fs.readFile(file, "utf8");

        // reverted to original (unchanged)
        expect(after).toBe(before);
        // backup should exist
        const backupsRoot = path.join(dir, ".nectar", "backups");
        const hasBackup = await fs.readdir(backupsRoot).then(x => x.length > 0).catch(() => false);
        expect(hasBackup).toBe(true);
    });
});
