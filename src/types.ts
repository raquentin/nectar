export type Finding = {
    id: string;
    rule: "SERVER_ONLY_IN_CLIENT" | "STAR_IMPORT_SLIMMING";
    severity: "info" | "warn" | "error";
    file: string;
    message: string;
    evidence?: Record<string, unknown>;
    autoFixable: boolean;
};

export type StarImportSlimSuggestion = {
    kind: "STAR_IMPORT_SLIMMING";
    file: string;
    summary: string;
    diffPreview?: string;
    data: {
        ns: string;
        lib: string;
        usedMembers: string[];
    };
};

export type DynamicHeavyDepSuggestion = {
    kind: "DYNAMIC_HEAVY_DEP";
    file: string;
    summary: string;
    diffPreview?: string;
    data: {
        localName: string;
        from: string;
    };
};

export type CodemodSuggestion = StarImportSlimSuggestion | DynamicHeavyDepSuggestion;
