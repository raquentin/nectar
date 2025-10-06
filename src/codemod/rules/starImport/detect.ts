import fs from "node:fs/promises";
import path from "node:path";

import type { NectarConfig } from "../../../lib/config.js";
import type { CodemodSuggestion } from "../../../types.js";

// detect star import slimming opportunities
export async function suggestStarImportSlimming(root = process.cwd(), cfg: NectarConfig): Promise<CodemodSuggestion[]> {
    if (!cfg.heavyDeps?.length) return [];
    const HEAVY = new Set(cfg.heavyDeps);

    const files = await walkTSLike(root);
    const out: CodemodSuggestion[] = [];
    for (const f of files) {
        const src = await fs.readFile(f, "utf8");
        const m = src.match(/import\s+\*\s+as\s+([A-Za-z_$][\w$]*)\s+from\s+["']([^"']+)["']/);
        if (!m) continue;
        const [, ns, lib] = m;
        if (!HEAVY.has(lib)) continue;

        const used = new Set<string>();
        const re = new RegExp(`\\b${ns}\\.([A-Za-z_$][\\w$]*)`, "g");
        let mm: RegExpExecArray | null;
        while ((mm = re.exec(src))) used.add(mm[1]);
        if (used.size === 0) continue;

        const members = [...used];
        out.push({
            kind: "STAR_IMPORT_SLIMMING",
            file: path.relative(root, f),
            summary: `Replace star import of ${lib} with subpaths: ${members.slice(0, 6).join(", ")}${members.length > 6 ? "…" : ""}`,
            diffPreview: [
                `- import * as ${ns} from '${lib}'`,
                ...members.slice(0, 6).map(m => `+ import ${m} from '${lib}/${m}'`),
                members.length > 6 ? `+ // …and ${members.length - 6} more` : ""
            ].filter(Boolean).join("\n"),
            data: { ns, lib, usedMembers: members }
        });
    }
    return out;
}

async function walkTSLike(root: string): Promise<string[]> {
    const out: string[] = [];
    const dirents = async (d: string) => (await fs.readdir(d, { withFileTypes: true }));
    async function rec(d: string) {
        for (const e of await dirents(d)) {
            if (e.name.startsWith(".next")) continue;
            const p = path.join(d, e.name);
            if (e.isDirectory()) await rec(p);
            else if (/\.(tsx?|jsx?)$/.test(e.name)) out.push(p);
        }
    }
    await rec(root);
    return out;
}
