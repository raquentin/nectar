import { describe, it, expect } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { validateConfigFile } from "../src/lib/validateConfig.js";

describe("validate config", () => {
    it("flags missing file and invalid JSON", async () => {
        const dir = await fs.mkdtemp(path.join(os.tmpdir(), "nectar-validate-"));
        process.chdir(dir);
        const missing = await validateConfigFile("nectar.config.json");
        expect(missing.ok).toBe(false);
        expect(missing.issues[0].message).toMatch(/File not found/);

        await fs.writeFile("nectar.config.json", "{not-json");
        const bad = await validateConfigFile("nectar.config.json");
        expect(bad.ok).toBe(false);
        expect(bad.issues[0].message).toMatch(/Invalid JSON/);
    });

    it("accepts good shape and reports duplicates", async () => {
        const dir = await fs.mkdtemp(path.join(os.tmpdir(), "nectar-validate2-"));
        process.chdir(dir);
        await fs.writeFile("nectar.config.json", JSON.stringify({
            heavyDeps: ["chart.js", "Chart.JS", "date-fns"],
            dynamicAllowlist: ["Chart", "Map", "Chart"],
            pages: { include: ["/**"], exclude: [] },
            thresholds: { minKBDeltaToReport: 25 }
        }));
        const res = await validateConfigFile("nectar.config.json");
        expect(res.ok).toBe(false); // duplicates present
        const msgs = res.issues.map(i => i.message).join(" | ");
        expect(msgs).toMatch(/duplicate entry/i);
    });

    it("passes a clean config", async () => {
        const dir = await fs.mkdtemp(path.join(os.tmpdir(), "nectar-validate3-"));
        process.chdir(dir);
        await fs.writeFile("nectar.config.json", JSON.stringify({
            heavyDeps: ["chart.js", "date-fns"],
            dynamicAllowlist: ["Chart", "Map"],
            pages: { include: ["/**"], exclude: [] }
        }));
        const ok = await validateConfigFile("nectar.config.json");
        expect(ok.ok).toBe(true);
    });
});
