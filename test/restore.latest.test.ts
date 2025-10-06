import { describe, it, expect } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { restoreLatestBackup } from "../src/lib/restore.js";

describe("restoreLatestBackup", () => {
    it("restores the newest backup set", async () => {
        const root = await fs.mkdtemp(path.join(os.tmpdir(), "nectar-restore-"));
        const backups = path.join(root, ".nectar", "backups");
        const makeSet = async (stamp: string, rel: string, content: string) => {
            const dir = path.join(backups, stamp);
            await fs.mkdir(dir, { recursive: true });
            const encoded = rel.replace(/[\\/]/g, "__");
            await fs.writeFile(path.join(dir, encoded), content, "utf8");
        };

        // two snapshots
        await makeSet("20250101-1200", "src/a.ts", "old A");
        await makeSet("20250101-1200", "src/b.ts", "old B");
        await makeSet("20250105-0900", "src/a.ts", "new A");

        // corrupt current files
        const a = path.join(root, "src", "a.ts");
        const b = path.join(root, "src", "b.ts");
        await fs.mkdir(path.dirname(a), { recursive: true });
        await fs.writeFile(a, "BROKEN A", "utf8");
        await fs.writeFile(b, "BROKEN B", "utf8");

        const res = await restoreLatestBackup(root, backups);
        expect(res.ok).toBe(true);
        expect(res.restored).toBeGreaterThanOrEqual(1);

        const aNow = await fs.readFile(a, "utf8");
        const bNow = await fs.readFile(b, "utf8");
        expect(aNow).toBe("new A");
        expect(bNow).toBe("BROKEN B"); // not in latest
    });
});
