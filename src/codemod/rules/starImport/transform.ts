import type { StarImportSlimSuggestion } from "../../../types.js";

// pure transform: star import -> subpath imports + rewrites
export function transformStarImportSlimming(
    content: string,
    s: StarImportSlimSuggestion
): { after: string; changed: boolean; reason?: string } {
    const { ns, lib, usedMembers } = s.data;

    // remove all star imports of the target ns/lib (supports `;   import` on same line)
    const starImportRe = new RegExp(
        String.raw`(?:^|[\n\r]|;[ \t]*)\s*import\s*\*\s*as\s*${escapeRE(ns)}\s*from\s*['"]${escapeRE(lib)}['"]\s*;?`,
        "g"
    );

    // apply regex iteratively to handle multiple imports on the same line
    let afterRemove = content;
    let prevAfter;
    do {
        prevAfter = afterRemove;
        starImportRe.lastIndex = 0;
        afterRemove = afterRemove.replace(starImportRe, (m, offset) => {
            // preserve the separator that preceded the import
            const sep = m.match(/^(?:[\n\r]|;[ \t]*)?/)?.[0] ?? "";

            // if match ends with ';' and there's more content on the same line, preserve ';'
            if (m.trimEnd().endsWith(';')) {
                const rest = afterRemove.slice(offset + m.length);
                if (rest && !/^[\s]*[\r\n]/.test(rest)) {
                    return ';';
                }
            }
            return sep;
        });
    } while (afterRemove !== prevAfter);

    if (afterRemove === content) {
        return { after: content, changed: false, reason: "Star import not found" };
    }

    // build subpath imports (dedup + valid identifiers only)
    const members = Array.from(new Set(usedMembers.filter((m) => /^[A-Za-z_$][\w$]*$/.test(m))));
    const importBlock = members.map((m) => `import ${m} from '${lib}/${m}';`).join("\n");

    // insert the subpath imports after the last existing import statement
    let after = afterRemove;
    if (importBlock) {
        after = insertAfterImports(afterRemove, importBlock + "\n");
    }

    // rewrite ns.member -> member (word-boundary safe)
    for (const m of members) {
        const useRe = new RegExp(String.raw`\b${escapeRE(ns)}\.${escapeRE(m)}\b`, "g");
        after = after.replace(useRe, m);
    }

    return { after, changed: after !== content };
}

// insert block immediately after the last import statement
function insertAfterImports(src: string, block: string): string {
    const re = /^[ \t]*import[^\n]*\r?\n/gm;
    let lastEnd = -1;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src))) lastEnd = re.lastIndex;
    if (lastEnd === -1) return block + src;
    return src.slice(0, lastEnd) + block + src.slice(lastEnd);
}

function escapeRE(s: string) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

