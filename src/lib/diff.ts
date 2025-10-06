import { createTwoFilesPatch } from "diff";

export function makeUnifiedDiff(file: string, before: string, after: string): string {
    const patch = createTwoFilesPatch(`a/${file}`, `b/${file}`, before, after, "", "", { context: 3 });
    return patch.endsWith("\n") ? patch : patch + "\n";
}
