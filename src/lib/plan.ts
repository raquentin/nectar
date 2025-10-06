import fs from "node:fs/promises";
import path from "node:path";
import type { CodemodSuggestion } from "../types.js";
import { suggestionId } from "./id.js";

export type PlanItem = (CodemodSuggestion & { estimatedKB?: number; id?: string });
export type Plan = { createdAt: string; items: PlanItem[] };

export async function writePlan(items: PlanItem[], outDir = ".nectar"): Promise<string> {
    const withIds = items.map(it => ({ ...it, id: it.id ?? suggestionId(it) }));
    const plan: Plan = { createdAt: new Date().toISOString(), items: withIds };
    await fs.mkdir(outDir, { recursive: true });
    const p = path.join(outDir, "plan.json");
    await fs.writeFile(p, JSON.stringify(plan, null, 2));
    return p;
}

export async function readPlan(p: string): Promise<Plan> {
    const raw = await fs.readFile(p, "utf8");
    return JSON.parse(raw) as Plan;
}
