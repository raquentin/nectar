import fs from "node:fs/promises";
import path from "node:path";

export type LHRun = {
    route: string;
    run: number;
    lcpMs: number | null;
    fcpMs: number | null;
    tbtMs: number | null;
    cls: number | null;
    siMs: number | null;
    ttiMs: number | null;
    perfScore: number | null; // 0..1
};

export type LHRouteSummary = {
    route: string;
    runs: LHRun[];
    median: Omit<LHRun, "run" | "route"> & { runCount: number };
};

export type MeasureOptions = {
    base: string;
    routes: string[];
    runs?: number;
    chromePath?: string;
    outDir?: string;
    logLevel?: "silent" | "error" | "info" | "verbose";
    formFactor?: "desktop" | "mobile";
};

export async function measureAttach(opts: MeasureOptions) {
    const lhMod = await import("lighthouse");
    const lighthouse: any = (lhMod as any).default ?? lhMod; // handle different bundlers
    const { launch } = await import("chrome-launcher");

    const runs = Math.max(1, opts.runs ?? 3);
    const formFactor = opts.formFactor ?? "desktop";
    const outDir = opts.outDir ?? ".nectar";

    const chrome = await launch({
        chromePath: opts.chromePath || process.env.CHROME_PATH,
        chromeFlags: ["--headless=new", "--no-sandbox", "--disable-gpu"]
    });

    try {
        const summaries: LHRouteSummary[] = [];
        for (const r of opts.routes) {
            const url = joinURL(opts.base, r);
            const perRuns: LHRun[] = [];
            for (let i = 1; i <= runs; i++) {
                const lhr = await runLH(lighthouse, url, chrome.port!, formFactor, opts.logLevel ?? "error");
                perRuns.push({
                    route: r,
                    run: i,
                    lcpMs: num(lhr.audits["largest-contentful-paint"]?.numericValue),
                    fcpMs: num(lhr.audits["first-contentful-paint"]?.numericValue),
                    tbtMs: num(lhr.audits["total-blocking-time"]?.numericValue),
                    cls: num(lhr.audits["cumulative-layout-shift"]?.numericValue),
                    siMs: num(lhr.audits["speed-index"]?.numericValue),
                    ttiMs: num(lhr.audits["interactive"]?.numericValue),
                    perfScore: score(lhr.categories?.performance?.score)
                });
            }
            const med = (k: keyof Omit<LHRun, "run" | "route">) => median(perRuns.map(x => x[k] as number | null));
            summaries.push({
                route: r,
                runs: perRuns,
                median: {
                    lcpMs: med("lcpMs"),
                    fcpMs: med("fcpMs"),
                    tbtMs: med("tbtMs"),
                    cls: med("cls"),
                    siMs: med("siMs"),
                    ttiMs: med("ttiMs"),
                    perfScore: med("perfScore"),
                    runCount: perRuns.length
                }
            });
        }

        await fs.mkdir(outDir, { recursive: true });
        const file = path.join(outDir, "metrics.json");
        await fs.writeFile(file, JSON.stringify({
            createdAt: new Date().toISOString(),
            base: opts.base,
            formFactor,
            summaries
        }, null, 2));
        return { file, summaries };
    } finally {
        chrome.kill();
    }
}

function joinURL(base: string, route: string) {
    const b = base.endsWith("/") ? base.slice(0, -1) : base;
    const r = route.startsWith("/") ? route : `/${route}`;
    return `${b}${r}`;
}

async function runLH(lighthouse: any, url: string, port: number, formFactor: "desktop" | "mobile", logLevel: "silent" | "error" | "info" | "verbose") {
    const opts = {
        port,
        output: "json",
        logLevel,
        formFactor,
        screenEmulation: formFactor === "mobile"
            ? { mobile: true, width: 360, height: 640, deviceScaleFactor: 2, disabled: false }
            : { mobile: false, width: 1350, height: 940, deviceScaleFactor: 1, disabled: false }
    } as any;

    const res = await lighthouse(url, opts);
    return res.lhr;
}

function num(v: unknown): number | null {
    const n = typeof v === "number" ? v : null;
    return n == null || Number.isNaN(n) ? null : Math.round(n);
}

function score(v: unknown): number | null {
    if (typeof v !== "number") return null;
    return Math.round(v * 100) / 100;
}

function median(xs: Array<number | null>): number | null {
    const ys = xs.filter((v): v is number => typeof v === "number").sort((a, b) => a - b);
    if (ys.length === 0) return null;
    const mid = Math.floor(ys.length / 2);
    return ys.length % 2 ? ys[mid] : Math.round(((ys[mid - 1] + ys[mid]) / 2));
}
