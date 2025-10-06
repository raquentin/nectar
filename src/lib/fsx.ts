import fs from "node:fs/promises";
import path from "node:path";

// encode relative path for backup storage: replace separators with __
export function encodeBackupPath(rel: string): string {
    return rel.replace(/[\\/]/g, "__");
}

// decode backup filename back to relative path
export function decodeBackupPath(enc: string): string {
    return enc.replace(/__+/g, "/");
}

// read file if it exists, otherwise return null
export async function readFileIfExists(p: string): Promise<string | null> {
    try {
        return await fs.readFile(p, "utf8");
    } catch {
        return null;
    }
}

// ensure directory exists (recursive mkdir)
export async function mkdirp(dir: string): Promise<void> {
    await fs.mkdir(dir, { recursive: true });
}

// timestamp for backup folders: YYYYMMDD-HHMM
export function timestamp(d = new Date()): string {
    const pad = (n: number) => n.toString().padStart(2, "0");
    return (
        d.getFullYear().toString() +
        pad(d.getMonth() + 1) +
        pad(d.getDate()) +
        "-" +
        pad(d.getHours()) +
        pad(d.getMinutes())
    );
}

