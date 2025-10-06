import { describe, it, expect } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { validateConfigFile } from "../src/lib/validateConfig.js";

describe("config rules & thresholds", () => {
    it("flags unknown rule keys and bad minEstimatedKB", async () => {
        const dir = await fs.mkdtemp(path.join(os.tmpdir(), "nectar-cfg-"));
        process.chdir(dir);
        await fs.writeFile("nectar.config.json", JSON.stringify({
            rules: { STAR_IMPORT_SLIMMING: true, WAT: true },
            thresholds: { minEstimatedKB: -5 }
        }));
        const res = await validateConfigFile("nectar.config.json");
        const msgs = res.issues.map(i => `${i.path}:${i.message}`).join("|");
        expect(msgs).toMatch(/rules\.WAT:unknown rule key/);
        expect(msgs).toMatch(/thresholds\.minEstimatedKB:must be a non-negative number/);
        expect(res.ok).toBe(false);
    });

    it("accepts proper rules + thresholds", async () => {
        const dir = await fs.mkdtemp(path.join(os.tmpdir(), "nectar-cfg-ok-"));
        process.chdir(dir);
        await fs.writeFile("nectar.config.json", JSON.stringify({
            rules: { STAR_IMPORT_SLIMMING: true, DYNAMIC_HEAVY_DEP: false },
            thresholds: { minEstimatedKB: 12 }
        }));
        const res = await validateConfigFile("nectar.config.json");
        expect(res.ok).toBe(true);
    });
});
