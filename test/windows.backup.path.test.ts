import { describe, it, expect } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { restoreLatestBackup } from "../src/lib/restore.js";

describe("backups path encoding (nested & windows-like)", () => {
    it("restores from timestamped folder and decodes __ to path separators", async () => {
        const root = await fs.mkdtemp(path.join(os.tmpdir(), "nectar-bak-"));
        const backups = path.join(root, ".nectar", "backups");
        await fs.mkdir(backups, { recursive: true });

        // simulate windows-like path encoded with __
        const latest = path.join(backups, "20251231-2359");
        await fs.mkdir(latest, { recursive: true });
        const encoded = "src__components__charts__Big.tsx";
        await fs.writeFile(path.join(latest, encoded), "// restored content", "utf8");

        // corrupt current file to verify restoration
        const dest = path.join(root, "src", "components", "charts", "Big.tsx");
        await fs.mkdir(path.dirname(dest), { recursive: true });
        await fs.writeFile(dest, "// broken", "utf8");

        const res = await restoreLatestBackup(root, backups);
        expect(res.ok).toBe(true);
        const now = await fs.readFile(dest, "utf8");
        expect(now).toBe("// restored content");
    });
});
