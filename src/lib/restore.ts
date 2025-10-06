import fs from "node:fs/promises";
import path from "node:path";

import { decodeBackupPath, mkdirp } from "./fsx.js";

// restore most recent backup from .nectar/backups
export async function restoreLatestBackup(root = process.cwd(), backupsDir = path.join(root, ".nectar", "backups")) {
    let entries: string[] = [];
    try {
        entries = await fs.readdir(backupsDir);
    } catch {
        return { ok: false, reason: "No backups directory" };
    }
    const dirs = entries.filter((d) => !d.startsWith("."));
    if (dirs.length === 0) return { ok: false, reason: "No backups found" };

    // newest lexicographically
    dirs.sort().reverse();
    const latest = path.join(backupsDir, dirs[0]);

    const files = await fs.readdir(latest);
    let restored = 0;
    for (const f of files) {
        const bakPath = path.join(latest, f);
        const origRel = decodeBackupPath(f);
        const dest = path.join(root, origRel);
        try {
            const data = await fs.readFile(bakPath, "utf8");
            await mkdirp(path.dirname(dest));
            await fs.writeFile(dest, data, "utf8");
            restored++;
        } catch {
            // continue
        }
    }
    return { ok: true, restored, folder: latest };
}
