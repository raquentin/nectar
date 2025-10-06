import crypto from "node:crypto";
import type { CodemodSuggestion } from "../types.js";

// stable id per suggestion
export function suggestionId(s: CodemodSuggestion): string {
    const keyObj: any = {
        kind: s.kind,
        file: s.file,
        // include the minimal data needed to uniquely identify the transformation
        data: s.kind === "STAR_IMPORT_SLIMMING"
            ? { lib: s.data.lib, ns: s.data.ns, used: [...new Set(s.data.usedMembers)].sort() }
            : { from: s.data.from, local: s.data.localName }
    };
    const stable = stableJSONStringify(keyObj);
    return crypto.createHash("sha1").update(stable).digest("hex").slice(0, 12);
}

function stableJSONStringify(v: unknown): string {
    return JSON.stringify(sortDeep(v));
}

function sortDeep(v: any): any {
    if (Array.isArray(v)) return v.map(sortDeep).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
    if (v && typeof v === "object") {
        return Object.fromEntries(Object.keys(v).sort().map(k => [k, sortDeep(v[k])]));
    }
    return v;
}
