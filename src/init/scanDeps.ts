import fs from "node:fs/promises";
import path from "node:path";

export type InitOptions = {
    root?: string;
    top?: number;               // keep top-N heaviest deps
    sizeThresholdKB?: number;   // minimum size to include
    ignore?: string[];          // package ignore globs (e.g., ["@types/*","eslint*"])
    depth?: number;             // how deep to scan inside each package dir (default 2)
    srcDepth?: number;          // how deep to scan src/ for allowlist hints (default 4)
};

export async function proposeConfig(opts: InitOptions = {}) {
    const root = opts.root ?? process.cwd();
    const top = opts.top ?? 15;
    const minKB = opts.sizeThresholdKB ?? 80;
    const ignore = (opts.ignore ?? []).map(globToRegExp);
    const pkgDepth = opts.depth ?? 2;
    const srcDepth = opts.srcDepth ?? 4;

    const nm = path.join(root, "node_modules");
    const pkgSizes = await scanNodeModules(nm, ignore, pkgDepth);

    const heavyDeps = pkgSizes
        .filter(p => p.sizeKB >= minKB)
        .sort((a, b) => b.sizeKB - a.sizeKB)
        .slice(0, top)
        .map(p => p.name);

    const dynamicAllowlist = await suggestComponentHints(path.join(root, "src"), srcDepth);

    return {
        heavyDeps,
        dynamicAllowlist,
        pages: { include: ["/**"], exclude: [] },
        thresholds: { minKBDeltaToReport: 25, minMsDeltaToReport: 150 }
    };
}

async function scanNodeModules(
    nmRoot: string,
    ignore: RegExp[],
    maxDepth: number
) {
    const out: { name: string; sizeKB: number }[] = [];

    const isIgnored = (name: string) => ignore.some(rx => rx.test(name));

    async function scanPkg(pkgDir: string, name: string) {
        if (isIgnored(name)) return;
        let total = 0;
        async function rec(dir: string, depth: number) {
            if (depth > maxDepth) return;
            let ents: any[] = [];
            try { ents = await fs.readdir(dir, { withFileTypes: true }); } catch { return; }
            for (const e of ents) {
                const p = path.join(dir, e.name);
                if (e.isDirectory()) await rec(p, depth + 1);
                else if (/\.(m?js|cjs)$/.test(e.name)) {
                    try { total += (await fs.stat(p)).size; } catch { }
                }
            }
        }
        await rec(pkgDir, 0);
        out.push({ name, sizeKB: +(total / 1024).toFixed(1) });
    }

    async function scanScope(scopeDir: string, scope: string) {
        let ents: any[] = [];
        try { ents = await fs.readdir(scopeDir, { withFileTypes: true }); } catch { return; }
        for (const e of ents) {
            if (!e.isDirectory()) continue;
            const full = `${scope}/${e.name}`;
            if (isIgnored(full)) continue;
            await scanPkg(path.join(scopeDir, e.name), full);
        }
    }

    let ents: any[] = [];
    try { ents = await fs.readdir(nmRoot, { withFileTypes: true }); } catch { return out; }
    for (const e of ents) {
        if (!e.isDirectory()) continue;
        if (e.name.startsWith(".")) continue;
        if (e.name.startsWith("@")) {
            await scanScope(path.join(nmRoot, e.name), e.name);
        } else {
            if (isIgnored(e.name)) continue;
            await scanPkg(path.join(nmRoot, e.name), e.name);
        }
    }
    return out;
}

async function suggestComponentHints(srcRoot: string, maxDepth: number) {
    const hints = new Set<string>();
    const patterns = ["Chart", "Map", "Editor", "Graph", "Canvas"]; // init-only hints
    async function rec(dir: string, depth = 0) {
        if (depth > maxDepth) return;
        let ents: any[] = [];
        try { ents = await fs.readdir(dir, { withFileTypes: true }); } catch { return; }
        for (const e of ents) {
            const p = path.join(dir, e.name);
            if (e.isDirectory()) await rec(p, depth + 1);
            else if (/\.(t|j)sx?$/.test(e.name)) {
                for (const kw of patterns) if (e.name.toLowerCase().includes(kw.toLowerCase())) hints.add(kw);
            }
        }
    }
    await rec(srcRoot, 0);
    return Array.from(hints);
}

function globToRegExp(glob: string): RegExp {
    // very small glob -> regex: escape, then * => .*
    const esc = glob.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
    return new RegExp(`^${esc}$`);
}
