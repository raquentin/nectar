import { describe, it, expect } from "vitest";
import path from "node:path";

import { suggestDynamicHeavyDep } from "../src/codemod/rules/dynamicHeavy/detect.js";
import { testConfig } from "./test-config.js";

const demoRoot = path.resolve(__dirname, "../examples/nectar-demo");

describe("detectors", () => {
    it("suggests dynamic() for heavy deps in components", async () => {
        const sugg = await suggestDynamicHeavyDep(demoRoot, testConfig);
        expect(sugg.length).toBeGreaterThan(0);
        const hit = sugg.find(s => s.file.endsWith("components/Chart.tsx"));
        expect(hit?.summary).toMatch(/next\/dynamic/);
    });
});
