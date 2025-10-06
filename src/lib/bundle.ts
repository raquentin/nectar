import fs from "node:fs/promises";

type BuildManifest = { pages: Record<string, string[]> };

export type RouteJS = { path: string; initialJsKB: number; assets: string[] };

export type BundleSnapshot = {
    routes: RouteJS[];
    assetSizes: Record<string, number>; // bytes per asset (0 if unknown)
    createdAt: string;
};

export async function readBundleSnapshot(
    root: string,
    manifestPath?: string,
    sizesMap?: string
): Promise<BundleSnapshot | null> {
    try {
        const manRaw = await fs.readFile(manifestPath ?? `${root}/.next/build-manifest.json`, "utf8");
        const manifest: BuildManifest = JSON.parse(manRaw);
        const sizesLookup = sizesMap
            ? (JSON.parse(await fs.readFile(sizesMap, "utf8")) as Record<string, number>)
            : {};

        const assetSizes: Record<string, number> = {};
        const routes: RouteJS[] = [];

        for (const [route, assets] of Object.entries(manifest.pages)) {
            const jsAssets = assets.filter((a) => a.endsWith(".js"));

            // populate assetSizes map once
            for (const rel of jsAssets) {
                if (assetSizes[rel] != null) continue;
                if (sizesLookup[rel] != null) {
                    assetSizes[rel] = sizesLookup[rel];
                } else {
                    try {
                        const st = await fs.stat(`${root}/.next/${rel}`);
                        assetSizes[rel] = st.size;
                    } catch {
                        assetSizes[rel] = 0;
                    }
                }
            }

            const totalBytes = jsAssets.reduce((acc, a) => acc + (assetSizes[a] ?? 0), 0);
            routes.push({ path: route, initialJsKB: totalBytes / 1024, assets: jsAssets });
        }

        return { routes, assetSizes, createdAt: new Date().toISOString() };
    } catch {
        return null;
    }
}
