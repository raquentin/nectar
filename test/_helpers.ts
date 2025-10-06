import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const requireFromHere = createRequire(import.meta.url);

// run cmd, return stdout+err
export function runCLI(cwd: string, args: string[]): string {
    const repoRoot = path.resolve(__dirname, "..");
    const cli = path.join(repoRoot, "src", "index.ts");
    let tsxLoader: string;
    try { tsxLoader = requireFromHere.resolve("tsx/esm"); } catch { tsxLoader = requireFromHere.resolve("tsx"); }
    const res = spawnSync("node", ["--import", tsxLoader, cli, ...args], {
        cwd, encoding: "utf8",
        env: { ...process.env, FORCE_COLOR: "0", NODE_PATH: path.join(repoRoot, "node_modules") }
    });
    if (res.status !== 0 && res.status !== null) {
        throw new Error(`CLI failed: ${res.stderr || res.stdout}`);
    }
    return (res.stdout || "") + (res.stderr || "");
}

// run cmd, return full SpawnSyncReturns
export function runCLIWithStatus(cwd: string, args: string[]): SpawnSyncReturns<string> {
    const repoRoot = path.resolve(__dirname, "..");
    const cli = path.join(repoRoot, "src", "index.ts");
    let tsxLoader: string;
    try { tsxLoader = requireFromHere.resolve("tsx/esm"); } catch { tsxLoader = requireFromHere.resolve("tsx"); }
    return spawnSync("node", ["--import", tsxLoader, cli, ...args], {
        cwd, encoding: "utf8",
        env: { ...process.env, FORCE_COLOR: "0", NODE_PATH: path.join(repoRoot, "node_modules") }
    });
}

// naive slice, outermost {}
export function parseJSON(out: string): any {
    const trimmed = out.trimEnd();
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start === -1 || end === -1) throw new Error("No JSON object found in output");
    return JSON.parse(trimmed.slice(start, end + 1));
}

export async function mkTempDir(prefix = "nectar-test-"): Promise<string> {
    return await fs.mkdtemp(path.join(os.tmpdir(), prefix));
}
