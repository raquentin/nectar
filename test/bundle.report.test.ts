import { describe, it, expect } from "vitest";
import path from "node:path";
import fs from "node:fs/promises";

import { readBundleSnapshot } from "../src/lib/bundle.js";
import { writeReport } from "../src/lib/report.js";

const demoRoot = path.resolve(__dirname, "../examples/nectar-demo");

describe("bundle snapshot from demo", () => {
    it("computes Initial JS KB using sizes map", async () => {
        const manifest = path.join(demoRoot, "manifest/build-manifest.json");
        const sizes = path.join(demoRoot, "manifest/sizes.json");
        const snap = await readBundleSnapshot(demoRoot, manifest, sizes);
        expect(snap?.routes.length).toBe(3);
        const idx = snap?.routes.find(r => r.path === "/");
        expect(idx?.initialJsKB).toBeGreaterThan(50); // framework + main + index
    });

    it("writeReport creates a markdown file", async () => {
        const manifest = path.join(demoRoot, "manifest/build-manifest.json");
        const sizes = path.join(demoRoot, "manifest/sizes.json");
        const snap = await readBundleSnapshot(demoRoot, manifest, sizes);
        await writeReport(snap!, []);
        const exists = await fs.stat(".nectar/report.md").then(() => true, () => false);
        expect(exists).toBe(true);
    });
});
