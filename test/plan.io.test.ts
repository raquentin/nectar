import { describe, it, expect } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { writePlan, readPlan } from "../src/lib/plan.js";
import type { CodemodSuggestion } from "../src/types.js";

describe("plan IO", () => {
    it("writes and reads plan.json preserving order and payload", async () => {
        const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "nectar-plan-"));
        const outDir = path.join(tmp, ".nectar");

        const items: (CodemodSuggestion & { estimatedKB?: number })[] = [
            {
                kind: "DYNAMIC_HEAVY_DEP",
                file: "src/components/Chart.tsx",
                summary: "wrap chart.js",
                data: { localName: "Chart", from: "chart.js" },
                estimatedKB: 146.5
            },
            {
                kind: "STAR_IMPORT_SLIMMING",
                file: "src/pages/DatePage.tsx",
                summary: "slim date-fns",
                data: { ns: "dateFns", lib: "date-fns", usedMembers: ["format", "parseISO"] },
                estimatedKB: 78.1
            }
        ];

        const p = await writePlan(items, outDir);
        expect(p.endsWith("plan.json")).toBe(true);

        const plan = await readPlan(p);
        expect(Array.isArray(plan.items)).toBe(true);
        expect(plan.items.length).toBe(2);

        // order preserved
        expect(plan.items[0].kind).toBe("DYNAMIC_HEAVY_DEP");
        expect((plan.items[0] as any).estimatedKB).toBeCloseTo(146.5, 1);

        // payload preserved
        const star = plan.items[1] as any;
        expect(star.data.lib).toBe("date-fns");
        expect(star.data.usedMembers).toEqual(expect.arrayContaining(["format", "parseISO"]));
    });
});
