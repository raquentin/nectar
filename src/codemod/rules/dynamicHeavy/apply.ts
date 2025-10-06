import fs from "node:fs/promises";
import path from "node:path";

import type { CodemodSuggestion, DynamicHeavyDepSuggestion } from "../../../types.js";
import { transformDynamicHeavyDep } from "./transform.js";
import { encodeBackupPath, mkdirp, timestamp } from "../../../lib/fsx.js";

export type ApplyResult = {
    file: string;
    applied: boolean;
    reason?: string;
    bytesDelta?: number;
    backupsPath?: string;
};

// narrow to dynamic suggestions safely
function isDynamic(s: CodemodSuggestion): s is DynamicHeavyDepSuggestion {
    return (
        s.kind === "DYNAMIC_HEAVY_DEP" &&
        !!(s as any).data &&
        typeof (s as any).data.localName === "string" &&
        typeof (s as any).data.from === "string"
    );
}

// apply dynamic() wrapping suggestions (with backups)
export async function applyDynamicHeavyDep(
    suggs: CodemodSuggestion[],
    root = process.cwd()
): Promise<ApplyResult[]> {
    const targets = suggs.filter(isDynamic);
    const results: ApplyResult[] = [];
    if (!targets.length) return results;

    const ts = timestamp();
    const backupDir = path.join(root, ".nectar", "backups", ts);
    await mkdirp(backupDir);

    for (const s of targets) {
        const abs = path.join(root, s.file);
        try {
            const before = await fs.readFile(abs, "utf8");
            const { localName, from } = s.data;

            const { after, changed, reason } = transformDynamicHeavyDep(before, localName, from);
            if (!changed) {
                results.push({ file: s.file, applied: false, reason: reason ?? "No textual change produced" });
                continue;
            }

            const backupPath = path.join(backupDir, encodeBackupPath(s.file));
            await mkdirp(path.dirname(backupPath));
            await fs.writeFile(backupPath, before, "utf8");
            await fs.writeFile(abs, after, "utf8");

            results.push({
                file: s.file,
                applied: true,
                backupsPath: backupPath,
                bytesDelta: Buffer.byteLength(after) - Buffer.byteLength(before)
            });
        } catch (e: any) {
            results.push({ file: s.file, applied: false, reason: e?.message ?? String(e) });
        }
    }
    return results;
}

