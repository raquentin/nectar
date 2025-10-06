import fs from "node:fs/promises";
import path from "node:path";
import { Finding } from "../types.js";

const SERVER_ONLY = new Set(["fs", "path", "crypto", "child_process", "os"]);
const CLIENT_HINTS = ['"use client"', "\'use client\'"];
const CLIENT_HOOKS = new Set(["useState", "useEffect", "useLayoutEffect", "useRef", "useReducer", "useMemo", "useCallback"]);

export async function detectServerOnlyInClient(root = process.cwd()): Promise<Finding[]> {
    const files = await walkTSLike(root);
    const out: Finding[] = [];
    for (const f of files) {
        const src = await fs.readFile(f, "utf8");
        const isClient =
            CLIENT_HINTS.some(h => src.startsWith(h)) ||
            /\b(useState|useEffect|useLayoutEffect|useRef|useReducer|useMemo|useCallback)\s*\(/.test(src);

        if (!isClient) continue;

        const imports = [...src.matchAll(/import\s+[^;]+?from\s+["']([^"']+)["']/g)].map(m => m[1]);
        for (const mod of imports) {
            if (SERVER_ONLY.has(mod)) {
                out.push({
                    id: `F-SERVER-ONLY-${hash(f + mod)}`,
                    rule: "SERVER_ONLY_IN_CLIENT",
                    severity: "error",
                    file: path.relative(root, f),
                    message: `Client component imports server-only module "${mod}"`,
                    evidence: { module: mod },
                    autoFixable: false
                });
            }
        }
    }
    return out;
}

async function walkTSLike(root: string): Promise<string[]> {
    const out: string[] = [];
    async function rec(dir: string) {
        const ents = await fs.readdir(dir, { withFileTypes: true });
        for (const e of ents) {
            if (e.name.startsWith(".next")) continue;
            const p = path.join(dir, e.name);
            if (e.isDirectory()) await rec(p);
            else if (/\.(tsx?|jsx?)$/.test(e.name)) out.push(p);
        }
    }
    await rec(root);
    return out;
}

function hash(s: string) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
    return (h >>> 0).toString(16).slice(0, 8);
}
