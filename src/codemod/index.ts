export { suggestStarImportSlimming } from "./rules/starImport/detect.js";
export { suggestDynamicHeavyDep } from "./rules/dynamicHeavy/detect.js";

export { transformStarImportSlimming } from "./rules/starImport/transform.js";
export { transformDynamicHeavyDep } from "./rules/dynamicHeavy/transform.js";

export { applyStarImportSlimming, restoreBackups } from "./rules/starImport/apply.js";
export { applyDynamicHeavyDep } from "./rules/dynamicHeavy/apply.js";

export { previewStarImportSlimming, previewDynamicHeavyDep } from "./preview/diff.js";

export type { ApplyResult } from "./rules/starImport/apply.js";

export type { CodemodSuggestion, StarImportSlimSuggestion, DynamicHeavyDepSuggestion } from "../types.js";
