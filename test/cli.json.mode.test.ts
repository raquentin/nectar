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
    if (res.status !== 0 && res.status !== null) {
        throw new Error(`CLI failed: ${res.stderr || res.stdout}`);
    }
    return (res.stdout || "") + (res.stderr || "");
}

function makeTempProject() {
    return (async () => {
        const dir = await fs.mkdtemp(path.join(os.tmpdir(), "nectar-json-"));
        await fs.writeFile(path.join(dir, "nectar.config.json"), JSON.stringify({
            heavyDeps: ["date-fns"], dynamicAllowlist: ["Chart"]
        }));
        const src = path.join(dir, "src"); await fs.mkdir(src, { recursive: true });
        await fs.writeFile(path.join(src, "p.tsx"), `import * as dateFns from 'date-fns'; export default dateFns.format(new Date(),'y')`);
        const man = path.join(dir, "manifest"); await fs.mkdir(man, { recursive: true });
        await fs.writeFile(path.join(man, "build-manifest.json"), JSON.stringify({ pages: { "/": ["static/chunks/vendors-date-fns-x.js"] } }));
        await fs.writeFile(path.join(man, "sizes.json"), JSON.stringify({ "static/chunks/vendors-date-fns-x.js": 80000 }));
        return { dir, manifest: path.join(man, "build-manifest.json"), sizes: path.join(man, "sizes.json") };
    })();
}

describe("codemod --json emits a single JSON object (discovery path)", () => {
    it("stdout ends with '}' and parses cleanly", async () => {
        const { dir, manifest, sizes } = await makeTempProject();
        const out = runCLI(dir, ["codemod", "--json", "--fixture", manifest, "--sizes", sizes]);
        const trimmed = out.trimEnd();
        expect(trimmed.endsWith("}")).toBe(true);
        // slice first '{' to last '}'
        const start = trimmed.indexOf("{");
        const end = trimmed.lastIndexOf("}");
        const parsed = JSON.parse(trimmed.slice(start, end + 1));
        expect(Array.isArray(parsed.plan)).toBe(true);
    });
});
