import { describe, it, expect } from "vitest";

import { transformStarImportSlimming } from "../src/codemod/rules/starImport/transform.js";
import type { CodemodSuggestion } from "../src/types.js";

function mk(base: string, used: string[]): CodemodSuggestion {
    return {
        kind: "STAR_IMPORT_SLIMMING",
        file: "x.tsx",
        summary: "",
        data: { ns: "dateFns", lib: "date-fns", usedMembers: used }
    };
}

describe("STAR_IMPORT_SLIMMING edge cases", () => {
    it("keeps existing named imports and adds missing subpaths only", () => {
        const before = `
      import { addDays } from 'date-fns';
      import * as dateFns from 'date-fns';
      export const X = () => dateFns.format(dateFns.parseISO("2025-10-01"), "y") + addDays(new Date(), 1);
    `;
        const s = mk(before, ["format", "parseISO"]);
        const { after, changed } = transformStarImportSlimming(before, s as any);
        expect(changed).toBe(true);
        expect(after).toMatch(/import { addDays } from 'date-fns';/);
        expect(after).toMatch(/import format from 'date-fns\/format';/);
        expect(after).toMatch(/import parseISO from 'date-fns\/parseISO';/);
        expect(after).not.toMatch(/\* as dateFns/);
        expect(after).toMatch(/\bformat\(/);
        expect(after).toMatch(/\bparseISO\(/);
    });

    it("handles multiple star imports of the same ns (idempotent)", () => {
        const before = `
      import * as dateFns from 'date-fns'; import * as dateFns  from  "date-fns";
      const d = dateFns.parseISO("2025-10-01"); export default dateFns.format(d,"y");
    `;
        const s = mk(before, ["parseISO", "format"]);
        const { after } = transformStarImportSlimming(before, s as any);
        const starCount = (after.match(/\* as dateFns/g) || []).length;
        expect(starCount).toBe(0);
        expect(after).toMatch(/import format from 'date-fns\/format';/);
        expect(after).toMatch(/import parseISO from 'date-fns\/parseISO';/);
    });

    it("no-op when star import not present", () => {
        const before = `import { format } from 'date-fns'; export default format(new Date(),"y")`;
        const s = mk(before, ["format"]);
        const { changed, reason } = transformStarImportSlimming(before, s as any);
        expect(changed).toBe(false);
        expect(reason).toMatch(/Star import not found/);
    });
});
