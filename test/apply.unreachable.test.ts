import { describe, it, expect } from "vitest";
import path from "node:path";

import { applyStarImportSlimming } from "../src/codemod/rules/starImport/apply.js";
import type { CodemodSuggestion } from "../src/types.js";

describe("applyStarImportSlimming handles unreadable/missing files", async () => {
    it("returns a non-applied result with reason", async () => {
        const sugg: CodemodSuggestion = {
            kind: "STAR_IMPORT_SLIMMING",
            file: "does/not/exist.tsx", // missing on purpose
            summary: "",
            data: { ns: "dateFns", lib: "date-fns", usedMembers: ["format"] }
        };
        const res = await applyStarImportSlimming([sugg], path.join(process.cwd(), "__tmp_does_not_exist__"));
        expect(res.length).toBe(1);
        expect(res[0].applied).toBe(false);
        expect(typeof res[0].reason).toBe("string");
    });
});
