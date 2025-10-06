import fs from "node:fs/promises";
import path from "node:path";

import type { CodemodSuggestion, StarImportSlimSuggestion, DynamicHeavyDepSuggestion } from "../../types.js";
import { makeUnifiedDiff } from "../../lib/diff.js";
import { transformStarImportSlimming } from "../rules/starImport/transform.js";
import { transformDynamicHeavyDep } from "../rules/dynamicHeavy/transform.js";

// preview diffs for star import slimming suggestions (no writes)
export async function previewStarImportSlimming(
    suggs: CodemodSuggestion[],
    root = process.cwd()
): Promise<{ file: string; diff: string }[]> {
    const out: { file: string; diff: string }[] = [];
    const targets = suggs.filter((s): s is StarImportSlimSuggestion => s.kind === "STAR_IMPORT_SLIMMING");
    for (const s of targets) {
        const abs = path.join(root, s.file);
        try {
            const before = await fs.readFile(abs, "utf8");
            const { after, changed } = transformStarImportSlimming(before, s);
            if (changed) {
                out.push({ file: s.file, diff: makeUnifiedDiff(s.file, before, after) });
            }
        } catch {
            // ignore unreadable files in preview
        }
    }
    return out;
}

// preview diffs for dynamic() suggestions (no writes)
export async function previewDynamicHeavyDep(
    suggs: CodemodSuggestion[],
    root = process.cwd()
): Promise<{ file: string; diff: string }[]> {
    const out: { file: string; diff: string }[] = [];
    const targets = suggs.filter((s): s is DynamicHeavyDepSuggestion => s.kind === "DYNAMIC_HEAVY_DEP");

    for (const s of targets) {
        const abs = path.join(root, s.file);
        try {
            const before = await fs.readFile(abs, "utf8");
            const { after, changed } = transformDynamicHeavyDep(before, s.data.localName, s.data.from);
            if (changed) {
                out.push({ file: s.file, diff: makeUnifiedDiff(s.file, before, after) });
            }
        } catch {
            // ignore unreadable files in preview
        }
    }
    return out;
}

