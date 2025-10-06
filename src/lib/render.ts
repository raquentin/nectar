import fs from "node:fs/promises";
import path from "node:path";
import { suggestionId } from "./id.js";

export type PlanItem = {
    id?: string;
    kind: "STAR_IMPORT_SLIMMING" | "DYNAMIC_HEAVY_DEP";
    file: string;
    summary?: string;
    estimatedKB?: number;
    data: any;
};
export type Plan = { createdAt?: string; items: PlanItem[] };

export async function loadPlan(p = ".nectar/plan.json"): Promise<Plan> {
    const abs = path.resolve(process.cwd(), p);
    const raw = await fs.readFile(abs, "utf8");
    const j = JSON.parse(raw);
    const items: PlanItem[] = (j.items ?? j.plan ?? []) as any[];
    // ensure ids present
    for (const it of items) if (!it.id) it.id = suggestionId(it as any);
    return { createdAt: j.createdAt, items };
}

export async function loadTextIfExists(p?: string): Promise<string | null> {
    if (!p) return null;
    try { return await fs.readFile(path.resolve(process.cwd(), p), "utf8"); }
    catch { return null; }
}

export function filterItems(items: PlanItem[], only?: string, except?: string) {
    const onlyIds = (only ?? "").split(",").map(s => s.trim()).filter(Boolean);
    const exceptIds = (except ?? "").split(",").map(s => s.trim()).filter(Boolean);
    let out = items.slice();
    if (onlyIds.length) out = out.filter(i => i.id && onlyIds.includes(i.id));
    if (exceptIds.length) out = out.filter(i => !(i.id && exceptIds.includes(i.id)));
    return out;
}

export function totals(items: PlanItem[]) {
    const totalKB = items.reduce((a, b) => a + (Number(b.estimatedKB) || 0), 0);
    const byRule: Record<string, { count: number; kb: number }> = {};
    for (const it of items) {
        const r = byRule[it.kind] ?? { count: 0, kb: 0 };
        r.count += 1; r.kb += Number(it.estimatedKB) || 0;
        byRule[it.kind] = r;
    }
    return { count: items.length, totalKB, byRule };
}

export function renderSummaryMD(items: PlanItem[]) {
    const header = "## Suggestions Summary\n\n";
    if (!items.length) return header + "_No suggestions._\n";
    const lines = [
        header,
        "| ID | Rule | Target | File | Est. KB |",
        "|---:|:-----|:-------|:-----|-------:|",
        ...items.slice(0, 50).map(it => {
            const target = it.kind === "STAR_IMPORT_SLIMMING" ? it.data?.lib : it.data?.from;
            const kb = it.estimatedKB == null ? "—" : `${(it.estimatedKB as number).toFixed(1)}`;
            return `|\`${it.id}\`|${it.kind}|${target ?? "—"}|${it.file}|${kb}|`;
        }),
        "",
    ];
    return lines.join("\n");
}

export function renderCommentMD(items: PlanItem[], report?: string | null, diff?: string | null) {
    const head = `<!-- NECTAR_PR_COMMENT -->
# 🌺 nectar suggestions

Use \`--only <id,id>\` or \`--except <id,id>\` to refine next runs.
`;
    const summary = renderSummaryMD(items);
    const reportBlock = report
        ? `\n## Report (excerpt)\n\n<details><summary>Open</summary>\n\n\`\`\`md\n${clip(report, 6000)}\n\`\`\`\n\n</details>\n`
        : "";
    const diffBlock = diff
        ? `\n## Proposed Diff (dry-run)\n\n<details><summary>Open unified diff</summary>\n\n\`\`\`diff\n${clip(diff, 60000)}\n\`\`\`\n\n</details>\n`
        : "";
    const cmds = items.length
        ? `\n### Quick commands\n\n` +
        "```bash\n" +
        "pnpm nectar codemod --limit 3 --apply --no-typecheck\n" +
        "pnpm nectar codemod --only <id> --apply --no-typecheck\n" +
        "```\n"
        : "";
    return head + "\n" + summary + cmds + reportBlock + diffBlock;
}

export function renderJSON(items: PlanItem[]) {
    const t = totals(items);
    return { items, totals: t };
}

function clip(s: string, max: number) {
    if (s.length <= max) return s;
    return s.slice(0, max) + `\n... (truncated, total ${s.length} chars)`;
}
