import fs from "node:fs/promises";
import { BundleSnapshot } from "./bundle.js";
import { DupVendorFinding } from "../analyze/dupVendors.js";

export async function writeReport(snap: BundleSnapshot, dupVendors?: DupVendorFinding[]) {
    const lines: string[] = [];
    lines.push("# 🌺 nectar report (baseline)");
    lines.push("");
    lines.push("## Per-route Initial JS");
    lines.push("| Route | Initial JS (KB) | Assets |");
    lines.push("|-------|-----------------:|--------|");
    for (const r of snap.routes) {
        lines.push(`| ${r.path} | ${r.initialJsKB.toFixed(1)} | ${r.assets.length} |`);
    }
    if (dupVendors && dupVendors.length) {
        lines.push("\n## Duplicate heavy vendors across routes");
        lines.push("| Library | Routes | Approx KB |");
        lines.push("|---------|--------|----------:|");
        for (const d of dupVendors) {
            lines.push(`| ${d.lib} | ${d.routes.join(", ")} | ${d.approxKB.toFixed(1)} |`);
        }
    }
    await fs.mkdir(".nectar", { recursive: true });
    await fs.writeFile(".nectar/report.md", lines.join("\n"));
}
