import type { BundleSnapshot } from "./bundle.js";
import type { CodemodSuggestion } from "../types.js";

export function estimateImpact(
    snap: BundleSnapshot | null,
    suggestions: CodemodSuggestion[]
): (CodemodSuggestion & { estimatedKB: number })[] {
    if (!snap) {
        return suggestions.map((s) => ({ ...s, estimatedKB: 0 }));
    }
    const { assetSizes } = snap;

    const libBytes = (needle: string) =>
        Object.entries(assetSizes)
            .filter(([asset]) => asset.includes(needle))
            .reduce((sum, [, bytes]) => sum + (bytes ?? 0), 0);

    return suggestions.map((s) => {
        let bytes = 0;
        if (s.kind === "STAR_IMPORT_SLIMMING") {
            bytes = libBytes(s.data.lib);
        } else if (s.kind === "DYNAMIC_HEAVY_DEP") {
            bytes = libBytes(s.data.from);
        }
        return { ...s, estimatedKB: +(bytes / 1024).toFixed(1) };
    });
}

