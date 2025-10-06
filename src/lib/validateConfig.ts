import fs from "node:fs/promises";

export type ValidationIssue = { path: string; message: string };

export async function validateConfigFile(path = "nectar.config.json"): Promise<{ ok: boolean; issues: ValidationIssue[]; config?: any }> {
    const issues: ValidationIssue[] = [];
    let raw: string;
    try {
        raw = await fs.readFile(path, "utf8");
    } catch {
        return { ok: false, issues: [{ path, message: "File not found" }] };
    }
    let cfg: any;
    try {
        cfg = JSON.parse(raw);
    } catch (e: any) {
        return { ok: false, issues: [{ path, message: `Invalid JSON: ${e?.message ?? String(e)}` }] };
    }

    // shape checks
    checkArrayOfStrings(cfg, "heavyDeps", issues);
    checkArrayOfStrings(cfg, "dynamicAllowlist", issues);
    if (cfg.pages != null) {
        if (typeof cfg.pages !== "object") issues.push({ path: "pages", message: "pages must be an object" });
        else {
            if (cfg.pages.include != null) checkArrayOfStrings(cfg.pages, "include", issues, "pages.include");
            if (cfg.pages.exclude != null) checkArrayOfStrings(cfg.pages, "exclude", issues, "pages.exclude");
        }
    }
    if (cfg.thresholds != null && typeof cfg.thresholds !== "object") {
        issues.push({ path: "thresholds", message: "thresholds must be an object" });
    }

    if (cfg.rules != null) {
        if (typeof cfg.rules !== "object") issues.push({ path: "rules", message: "rules must be an object" });
        else {
            const keys = ["STAR_IMPORT_SLIMMING", "DYNAMIC_HEAVY_DEP"];
            for (const k of Object.keys(cfg.rules)) {
                if (!keys.includes(k)) issues.push({ path: `rules.${k}`, message: "unknown rule key" });
                else if (typeof cfg.rules[k] !== "boolean") issues.push({ path: `rules.${k}`, message: "must be boolean" });
            }
        }
    }

    if (cfg.thresholds?.minEstimatedKB != null) {
        const v = cfg.thresholds.minEstimatedKB;
        if (typeof v !== "number" || !Number.isFinite(v) || v < 0) {
            issues.push({ path: "thresholds.minEstimatedKB", message: "must be a non-negative number" });
        }
    }

    dedupeReport(cfg, "heavyDeps", issues);
    dedupeReport(cfg, "dynamicAllowlist", issues);

    return { ok: issues.length === 0, issues, config: cfg };
}

function checkArrayOfStrings(obj: any, key: string, issues: ValidationIssue[], at?: string) {
    const where = at ?? key;
    if (obj[key] == null) return;
    if (!Array.isArray(obj[key])) issues.push({ path: where, message: "must be an array" });
    else if (!obj[key].every((x: any) => typeof x === "string")) issues.push({ path: where, message: "must contain only strings" });
}

function dedupeReport(cfg: any, key: string, issues: ValidationIssue[]) {
    if (!Array.isArray(cfg[key])) return;
    const seen = new Set<string>();
    for (const s of cfg[key]) {
        const k = s.toLowerCase();
        if (seen.has(k)) issues.push({ path: key, message: `duplicate entry: ${s}` });
        seen.add(k);
    }
}
