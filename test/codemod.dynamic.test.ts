import { describe, it, expect } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { suggestDynamicHeavyDep } from "../src/codemod/rules/dynamicHeavy/detect.js";
import { applyDynamicHeavyDep } from "../src/codemod/rules/dynamicHeavy/apply.js";
import { restoreBackups } from "../src/codemod/rules/starImport/apply.js";
import { testConfig } from "./test-config.js";

async function mkTempProject(): Promise<{ dir: string; file: string }> {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "nectar-dyn-"));
    const file = path.join(dir, "components", "Chart.tsx");
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(
        file,
        `
      // typical heavy default import
      import Chart from 'chart.js';
      export function ChartCard() {
        return <div>{String(Chart)}</div>;
      }
    `,
        "utf8"
    );
    // minimal tsconfig for tsc compatibility
    await fs.writeFile(path.join(dir, "tsconfig.json"), JSON.stringify({ compilerOptions: { jsx: "react-jsx" } }), "utf8");
    return { dir, file };
}

describe("dynamic heavy dep codemod", () => {
    it("suggests wrapping heavy default imports with next/dynamic", async () => {
        const { dir } = await mkTempProject();
        const sugg = await suggestDynamicHeavyDep(dir, testConfig);
        const hit = sugg.find((s) => s.file.endsWith("components/Chart.tsx"));
        expect(hit).toBeTruthy();
        expect(hit?.summary).toMatch(/next\/dynamic/);
        expect(hit?.data?.from).toBe("chart.js");
    });

    it("applies dynamic() wrapper and creates backups, and restoreBackups reverts it", async () => {
        const { dir, file } = await mkTempProject();
        const sugg = await suggestDynamicHeavyDep(dir, testConfig);
        const res = await applyDynamicHeavyDep(sugg, dir);
        const applied = res.find((r) => r.applied);
        expect(applied?.backupsPath).toBeTruthy();

        const after = await fs.readFile(file, "utf8");
        expect(after).toMatch(/import dynamic from 'next\/dynamic';/);
        expect(after).toMatch(/const Chart = dynamic\(\(\) => import\('chart\.js'\), \{ ssr: false \}\)/);

        // restore
        await restoreBackups(res, dir);
        const restored = await fs.readFile(file, "utf8");
        expect(restored).not.toMatch(/next\/dynamic/);
        expect(restored).toMatch(/import Chart from 'chart\.js';/);
    });
});
