import { BundleSnapshot } from "../lib/bundle.js";
import type { NectarConfig } from "../lib/config.js";

export type DupVendorFinding = { lib: string; count: number; routes: string[]; approxKB: number };

// detect duplicate vendors across routes
export function detectDuplicateVendors(snap: BundleSnapshot, cfg: NectarConfig): DupVendorFinding[] {
    const heavyLibs = new Set(cfg.heavyDeps);
    if (heavyLibs.size === 0) return [];

    const libToRoutes = new Map<string, Set<string>>();
    const libToKB = new Map<string, number>();

    for (const r of snap.routes) {
        for (const asset of r.assets) {
            for (const lib of heavyLibs) {
                if (asset.includes(lib)) {
                    if (!libToRoutes.has(lib)) libToRoutes.set(lib, new Set());
                    libToRoutes.get(lib)!.add(r.path);
                    libToKB.set(lib, (libToKB.get(lib) ?? 0) + r.initialJsKB / Math.max(1, r.assets.length));
                }
            }
        }
    }

    const outs: DupVendorFinding[] = [];
    for (const [lib, routes] of libToRoutes.entries()) {
        if (routes.size >= 2) outs.push({ lib, count: routes.size, routes: [...routes], approxKB: +(libToKB.get(lib) ?? 0).toFixed(1) });
    }
    return outs.sort((a, b) => b.approxKB - a.approxKB);
}
