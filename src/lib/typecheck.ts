import { spawn } from "node:child_process";

export async function runTypecheck(cwd = process.cwd()): Promise<{ ok: boolean; output: string }> {
    return new Promise((resolve) => {
        const proc = spawn("npx", ["tsc", "--noEmit"], { cwd, stdio: ["ignore", "pipe", "pipe"] });
        let out = "";
        proc.stdout.on("data", (d) => (out += String(d)));
        proc.stderr.on("data", (d) => (out += String(d)));
        proc.on("close", (code) => resolve({ ok: code === 0, output: out }));
    });
}
