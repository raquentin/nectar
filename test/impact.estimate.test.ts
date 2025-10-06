import { describe, it, expect } from "vitest";
import { estimateImpact } from "../src/lib/impact.js";
import type { BundleSnapshot } from "../src/lib/bundle.js";
import type { CodemodSuggestion } from "../src/types.js";

function mkSnap(): BundleSnapshot {
    // js assets with lib names for estimator matching
    return {
        routes: [
            {
                path: "/", initialJsKB: (120_000 + 80_000) / 1024, assets: [
                    "static/chunks/pages/index-AAA.js",
                    "static/chunks/vendors-date-fns-BBB.js"
                ]
            },
            {
                path: "/product/[id]", initialJsKB: (200_000 + 150_000) / 1024, assets: [
                    "static/chunks/pages/product-id-CCC.js",
                    "static/chunks/vendors-chart.js-DDD.js"
                ]
            }
        ],
        assetSizes: {
            "static/chunks/pages/index-AAA.js": 120_000,
            "static/chunks/vendors-date-fns-BBB.js": 80_000,
            "static/chunks/pages/product-id-CCC.js": 200_000,
            "static/chunks/vendors-chart.js-DDD.js": 150_000
        },
        createdAt: new Date().toISOString()
    };
}

describe("estimateImpact", () => {
    it("annotates STAR_IMPORT and DYNAMIC suggestions with estimatedKB from asset sizes", () => {
        const snap = mkSnap();

        const suggs: CodemodSuggestion[] = [
            {
                kind: "STAR_IMPORT_SLIMMING",
                file: "src/pages/DatePage.tsx",
                summary: "slim date-fns",
                data: { ns: "dateFns", lib: "date-fns", usedMembers: ["format", "parseISO"] }
            },
            {
                kind: "DYNAMIC_HEAVY_DEP",
                file: "src/components/Chart.tsx",
                summary: "wrap chart.js with dynamic()",
                data: { localName: "Chart", from: "chart.js" }
            }
        ];

        const ranked = estimateImpact(snap, suggs);

        const star = ranked.find(r => r.kind === "STAR_IMPORT_SLIMMING")!;
        const dyn = ranked.find(r => r.kind === "DYNAMIC_HEAVY_DEP")!;

        // date-fns: 80_000 bytes ~78.1 KB
        expect(star.estimatedKB).toBeCloseTo(80_000 / 1024, 1);

        // chart.js: 150_000 bytes ~146.5 KB
        expect(dyn.estimatedKB).toBeCloseTo(150_000 / 1024, 1);

        // dynamic > star
        expect(dyn.estimatedKB).toBeGreaterThan(star.estimatedKB);
    });

    it("returns 0 KB estimates when snapshot is null", () => {
        const suggs: CodemodSuggestion[] = [
            {
                kind: "STAR_IMPORT_SLIMMING",
                file: "a.tsx",
                summary: "",
                data: { ns: "d", lib: "date-fns", usedMembers: ["format"] }
            }
        ];
        const out = estimateImpact(null as any, suggs);
        expect(out[0].estimatedKB).toBe(0);
    });

    it("is robust when asset names partially match libraries", () => {
        const snap: BundleSnapshot = {
            routes: [
                {
                    path: "/", initialJsKB: (50_000 + 10_000) / 1024, assets: [
                        "static/chunks/vendors-date-fns-extra.js",
                        "static/chunks/pages/index.js"
                    ]
                }
            ],
            assetSizes: {
                "static/chunks/vendors-date-fns-extra.js": 50_000,
                "static/chunks/pages/index.js": 10_000
            },
            createdAt: new Date().toISOString()
        };
        const suggs: CodemodSuggestion[] = [{
            kind: "STAR_IMPORT_SLIMMING",
            file: "x.tsx",
            summary: "",
            data: { ns: "d", lib: "date-fns", usedMembers: ["format"] }
        }];
        const out = estimateImpact(snap, suggs);
        // substring match counts (v1 heuristic)
        expect(out[0].estimatedKB).toBeCloseTo(50_000 / 1024, 1);
    });
});
