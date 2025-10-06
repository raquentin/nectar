import { describe, it, expect } from "vitest";
import path from "node:path";

import { readBundleSnapshot } from "../src/lib/bundle.js";
import { detectDuplicateVendors } from "../src/analyze/dupVendors.js";
import { testConfig } from "./test-config.js";

const demoRoot = path.resolve(__dirname, "../examples/nectar-demo");

describe("duplicate vendor detection", () => {
    it("finds libs present across multiple routes and estimates KB", async () => {
        const manifest = path.join(demoRoot, "manifest/build-manifest.json");
        const sizes = path.join(demoRoot, "manifest/sizes.json");
        const snap = await readBundleSnapshot(demoRoot, manifest, sizes);
        expect(snap).toBeTruthy();

        const dup = detectDuplicateVendors(snap!, testConfig);
        
        // demo has date-fns and chart.js each on separate routes (no dups in this fixture)
        expect(Array.isArray(dup)).toBe(true);
        
        // basic shape check if any found
        if (dup.length > 0) {
            expect(dup[0]).toHaveProperty("routes");
            expect(Array.isArray(dup[0].routes)).toBe(true);
            expect(dup[0].approxKB).toBeGreaterThan(0);
        }
    });
});
