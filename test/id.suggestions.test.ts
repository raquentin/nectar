import { describe, it, expect } from "vitest";
import { suggestionId } from "../src/lib/id.js";
import type { CodemodSuggestion } from "../src/types.js";

describe("suggestionId", () => {
    it("stable across key order and member order", () => {
        const a: CodemodSuggestion = {
            kind: "STAR_IMPORT_SLIMMING",
            file: "src/pages/Date.tsx",
            summary: "",
            data: { ns: "d", lib: "date-fns", usedMembers: ["format", "parseISO"] }
        };
        const b: CodemodSuggestion = {
            kind: "STAR_IMPORT_SLIMMING",
            file: "src/pages/Date.tsx",
            summary: "",
            data: { lib: "date-fns", usedMembers: ["parseISO", "format"], ns: "d" } as any
        };
        expect(suggestionId(a)).toEqual(suggestionId(b));
    });

    it("differs for different files or libs", () => {
        const x: CodemodSuggestion = {
            kind: "DYNAMIC_HEAVY_DEP",
            file: "src/components/Chart.tsx",
            summary: "",
            data: { localName: "Chart", from: "chart.js" }
        };
        const y = { ...x, file: "src/components/Graph.tsx" } as CodemodSuggestion;
        expect(suggestionId(x)).not.toEqual(suggestionId(y));
    });
});
