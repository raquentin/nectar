import fs from "node:fs/promises";

export type NectarConfig = {
    pages?: { include?: string[]; exclude?: string[] };
    thresholds?: { minKBDeltaToReport?: number; minMsDeltaToReport?: number; minEstimatedKB?: number };
    heavyDeps: string[];
    dynamicAllowlist: string[];
    rules?: { STAR_IMPORT_SLIMMING?: boolean; DYNAMIC_HEAVY_DEP?: boolean };
};

export async function loadConfig(): Promise<NectarConfig> {
    const raw = await fs.readFile("nectar.config.json", "utf8").catch(() => null);
    if (!raw) {
        return { pages: { include: ["/**"], exclude: [] }, thresholds: {}, heavyDeps: [], dynamicAllowlist: [] };
    }
    const user = JSON.parse(raw);
    // coerce missing arrays to empty arrays
    return {
        pages: user.pages ?? { include: ["/**"], exclude: [] },
        thresholds: user.thresholds ?? {},
        heavyDeps: Array.isArray(user.heavyDeps) ? user.heavyDeps : [],
        dynamicAllowlist: Array.isArray(user.dynamicAllowlist) ? user.dynamicAllowlist : [],
        rules: user.rules
    };
}
