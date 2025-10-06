import { describe, it, expect } from "vitest";

import { transformDynamicHeavyDep } from "../src/codemod/rules/dynamicHeavy/transform.js";

describe("DYNAMIC_HEAVY_DEP idempotency", () => {
    it("adds wrapper even if dynamic import already exists", () => {
        const before = `
      import dynamic from 'next/dynamic';
      import Chart from 'chart.js';
      export default function C(){ return <div>{String(Chart)}</div> }
    `;
        const { after, changed } = transformDynamicHeavyDep(before, "Chart", "chart.js");
        expect(changed).toBe(true);
        // still only one import of dynamic
        expect((after.match(/from 'next\/dynamic'/g) || []).length).toBe(1);
        // default import replaced with dynamic const
        expect(after).toMatch(/const Chart = dynamic\(\(\) => import\('chart\.js'\), \{ ssr: false \}\)/);
    });

    it("no-op if default import not found", () => {
        const before = `import dynamic from 'next/dynamic'; export const X=()=>null;`;
        const { changed, reason } = transformDynamicHeavyDep(before, "Chart", "chart.js");
        expect(changed).toBe(false);
        expect(reason).toMatch(/Default import not found/);
    });
});
