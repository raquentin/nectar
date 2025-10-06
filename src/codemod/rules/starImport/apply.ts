import fs from "node:fs/promises";
import path from "node:path";

import type { CodemodSuggestion, StarImportSlimSuggestion } from "../../../types.js";
import { transformStarImportSlimming } from "./transform.js";
import { encodeBackupPath, mkdirp, timestamp } from "../../../lib/fsx.js";

export type ApplyResult = {
    file: string;
    applied: boolean;
    reason?: string;
    bytesDelta?: number;
    backupsPath?: string;
};

// apply star import slimming suggestions (with backups)
export async function applyStarImportSlimming(
    suggs: CodemodSuggestion[],
    root = process.cwd()
): Promise<ApplyResult[]> {
    const targets = suggs.filter(
        (s): s is StarImportSlimSuggestion =>
            s.kind === "STAR_IMPORT_SLIMMING" &&
            !!s.data?.ns &&
            !!s.data?.lib &&
            Array.isArray(s.data?.usedMembers) &&
            s.data.usedMembers.length > 0
    );

    const results: ApplyResult[] = [];
    if (!targets.length) return results;

    const ts = timestamp();
    const backupDir = path.join(root, ".nectar", "backups", ts);
    await mkdirp(backupDir);

    for (const s of targets) {
        const abs = path.join(root, s.file);
        try {
            const before = await fs.readFile(abs, "utf8");
            const { after, changed, reason } = transformStarImportSlimming(before, s);

            if (!changed) {
                results.push({ file: s.file, applied: false, reason: reason ?? "No textual changes produced" });
                continue;
            }

            // backup then write
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

// restore files from provided ApplyResult backups (where available)
export async function restoreBackups(results: ApplyResult[], root = process.cwd()): Promise<void> {
    for (const r of results) {
        if (!r.backupsPath) continue;
        const abs = path.join(root, r.file);
        try {
            const backup = await fs.readFile(r.backupsPath, "utf8");
            await fs.writeFile(abs, backup, "utf8");
        } catch {
            // ignore restore errors to avoid masking the original failure
        }
    }
}

