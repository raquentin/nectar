import fs from "node:fs/promises";
import path from "node:path";

import type { NectarConfig } from "../../../lib/config.js";
import type { CodemodSuggestion } from "../../../types.js";

// detect dynamic() wrapping opportunities for heavy deps
export async function suggestDynamicHeavyDep(root = process.cwd(), cfg: NectarConfig): Promise<CodemodSuggestion[]> {
    if (!cfg.heavyDeps?.length) return [];
    const HEAVY = new Set(cfg.heavyDeps);
    const allow = new Set(cfg.dynamicAllowlist ?? []);

    const files = await walkTSLike(root);
    const out: CodemodSuggestion[] = [];
    for (const f of files) {
        // require allowlist hint somewhere in the path or filename
        const hasHint = [...allow].some(h => f.toLowerCase().includes(h.toLowerCase()));
        if (allow.size && !hasHint) {
            continue;
        }

        const src = await fs.readFile(f, "utf8");
        if (!/components\//.test(f)) continue;
        if (/(_app|layout)\.(t|j)sx?$/.test(f)) continue;

        const m = [...src.matchAll(/import\s+([A-Za-z_$][\w$]*)\s+from\s+["']([^"']+)["']/g)];
        for (const mm of m) {
            const [, local, from] = mm;
            if (!HEAVY.has(from)) continue;

            const summary = `Wrap ${local} from '${from}' with next/dynamic({ ssr:false })`;
            const preview = [
                `+ import dynamic from 'next/dynamic'`,
                `- import ${local} from '${from}'`,
                `+ const ${local} = dynamic(() => import('${from}'), { ssr: false })`
            ].join("\n");

            out.push({
                kind: "DYNAMIC_HEAVY_DEP",
                file: path.relative(root, f),
                summary,
                diffPreview: preview,
                data: { localName: local, from }
            });
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

