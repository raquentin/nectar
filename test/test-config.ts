import type { NectarConfig } from "../src/lib/config.js";

export const testConfig: NectarConfig = {
    heavyDeps: ["date-fns", "lodash", "lodash-es", "d3", "chart.js", "three", "monaco-editor"],
    dynamicAllowlist: ["Chart", "Map", "Editor", "Graph"],
    pages: { include: ["/**"], exclude: [] },
    thresholds: { minKBDeltaToReport: 25, minMsDeltaToReport: 150 }
};
