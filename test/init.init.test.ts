import { describe, it, expect } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { proposeConfig } from "../src/init/scanDeps.js";

// create fake package with file of `kb` kilobytes at depth `d`
async function makePkg(nmRoot: string, name: string, kb: number, depth = 0) {
    const parts = name.startsWith("@") ? name.split("/") : [name];
    const dir = path.join(nmRoot, ...parts);
    await fs.mkdir(dir, { recursive: true });
    let cur = dir;
    for (let i = 0; i < depth; i++) {
        cur = path.join(cur, `d${i}`);
        await fs.mkdir(cur, { recursive: true });
    }
    const file = path.join(cur, "index.js");
    await fs.writeFile(file, Buffer.alloc(kb * 1024));
}

async function makeProject() {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "nectar-init-"));
    const nm = path.join(root, "node_modules");
    await fs.mkdir(nm, { recursive: true });

    // heavy packages
    await makePkg(nm, "chart.js", 150);
    await makePkg(nm, "three", 90, 1);
    await makePkg(nm, "@types/lodash", 500);
    await makePkg(nm, "eslint-utils", 300);
    await makePkg(nm, "@scope/deepbig", 200, 3);

    // src files for allowlist hints
    const src = path.join(root, "src", "components");
    await fs.mkdir(src, { recursive: true });
    await fs.writeFile(path.join(src, "BigChart.tsx"), "export const X=1;", "utf8");
    await fs.writeFile(path.join(src, "MapView.tsx"), "export const Y=1;", "utf8");

    return root;
}

describe("nectar init", () => {
    it("proposes heavyDeps honoring ignore globs and depth, and finds component hints", async () => {
        const root = await makeProject();

        // baseline: top by size with depth=2
        const base = await proposeConfig({
            root,
            top: 10,
            sizeThresholdKB: 50,
            depth: 2,
            ignore: [] // nothing ignored yet
        });
        expect(base.heavyDeps).toEqual(expect.arrayContaining(["chart.js", "three"]));
        // deepbig at depth 3 not counted when depth=2
        expect(base.heavyDeps).not.toContain("@scope/deepbig");

        // with ignore patterns
        const ignored = await proposeConfig({
            root,
            top: 10,
            sizeThresholdKB: 50,
            depth: 2,
            ignore: ["@types/*", "eslint*"]
        });
        expect(ignored.heavyDeps).not.toContain("@types/lodash");
        expect(ignored.heavyDeps).not.toContain("eslint-utils");
        expect(ignored.heavyDeps).toEqual(expect.arrayContaining(["chart.js", "three"]));

        // deeper scan: now deepbig is counted
        const deeper = await proposeConfig({
            root,
            top: 10,
            sizeThresholdKB: 50,
            depth: 3,
            ignore: ["@types/*", "eslint*"]
        });
        expect(deeper.heavyDeps).toEqual(expect.arrayContaining(["@scope/deepbig"]));

        // hints from src/components filenames
        expect(base.dynamicAllowlist).toEqual(expect.arrayContaining(["Chart", "Map"]));
    });
});

