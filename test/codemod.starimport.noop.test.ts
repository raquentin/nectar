import { describe, it, expect } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { suggestStarImportSlimming } from "../src/codemod/rules/starImport/detect.js";
import { applyStarImportSlimming } from "../src/codemod/rules/starImport/apply.js";
import { testConfig } from "./test-config.js";

describe("star import slimming no-op", () => {
    it("does nothing if no star import from heavy libs is present", async () => {
        const dir = await fs.mkdtemp(path.join(os.tmpdir(), "nectar-star-noop-"));
        const file = path.join(dir, "Foo.tsx");
        await fs.writeFile(
            file,
            `
        import { format } from 'date-fns'; // already slim
        export const Foo = () => format(new Date(), 'yyyy');
      `,
            "utf8"
        );
        const sugg = await suggestStarImportSlimming(dir, testConfig);
        expect(sugg.length).toBe(0);
        const res = await applyStarImportSlimming(sugg, dir);
        expect(res.length).toBe(0);
    });
});
