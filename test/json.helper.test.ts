import { describe, it, expect, vi } from "vitest";
import { maybePrintJSON } from "../src/lib/jsonOut.js";

describe("maybePrintJSON", () => {
    it("prints JSON when flag is truthy", () => {
        const spy = vi.spyOn(console, "log").mockImplementation(() => { });
        maybePrintJSON(true, { a: 1, b: "x" });
        expect(spy).toHaveBeenCalled();
        const arg = spy.mock.calls[0][0] as string;
        expect(arg).toMatch(/"a": 1/);
        expect(arg).toMatch(/"b": "x"/);
        spy.mockRestore();
    });

    it("stays silent when flag is falsey", () => {
        const spy = vi.spyOn(console, "log").mockImplementation(() => { });
        maybePrintJSON(false, { a: 1 });
        expect(spy).not.toHaveBeenCalled();
        spy.mockRestore();
    });
});
