// Coded by OpenAI Codex. User code is compiled here; it is never executed by Node.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, writeFile, readFile, rm, access } from "node:fs/promises";
import { tmpdir, homedir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const exec = promisify(execFile);
const require = createRequire(import.meta.url);
export const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const limits = Object.freeze({ bytes: 8192, lines: 100, cells: 50, sessionBytes: 100_000 });
const declarations = `// Coded by OpenAI Codex. Only this host capability is exposed.
declare const console: {
    log(...values: unknown[]): void;
    info(...values: unknown[]): void;
    warn(...values: unknown[]): void;
    error(...values: unknown[]): void;
    clear(): void;
};
`;
let compilerPromise;

// Coded by OpenAI Codex. Never fall back to the upstream TypeScript compiler.
export function getCompiler() {
    return compilerPromise ??= (async () => {
        if (process.env.TS_PIPE_COMPILER) {
            const command = resolve(process.env.TS_PIPE_COMPILER);
            await access(command);
            return { command, prefix: [] };
        }
        try {
            const manifestPath = require.resolve("@pengeszikra/typescript/package.json");
            const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
            return { command: process.execPath, prefix: [resolve(dirname(manifestPath), manifest.bin.tspipe)] };
        } catch {
            for (const name of ["Typescript", "TypeScript", "typescript"]) {
                const command = join(homedir(), "repo", name, "built/local", process.platform === "win32" ? "tsc.exe" : "tsc");
                try { await access(command); return { command, prefix: [] }; } catch { /* Coded by OpenAI Codex: try next location. */ }
            }
            throw new Error("Pipeline compiler missing. Run npm ci or set TS_PIPE_COMPILER to your fork's built/local/tsc executable.");
        }
    })();
}

// Coded by OpenAI Codex.
export function validateInput(body) {
    if (!body || typeof body.source !== "string" || !Array.isArray(body.history)) throw new Error("Invalid code request.");
    if (body.history.length >= limits.cells) throw new Error("Session limit: 50 submissions. Reset the session to continue.");
    const sources = [...body.history, body.source];
    if (sources.some(source => typeof source !== "string" || Buffer.byteLength(source) > limits.bytes || source.split("\n").length > limits.lines)) {
        throw new Error("Each submission is limited to 100 lines and 8 KB.");
    }
    if (sources.reduce((sum, source) => sum + Buffer.byteLength(source), 0) > limits.sessionBytes) throw new Error("Session code limit reached. Reset the session to continue.");
    return sources;
}

// Coded by OpenAI Codex. Separate global-script files retain types without replaying old code.
export async function compileInput(body, { checkOnly = false, signal } = {}) {
    const sources = validateInput(body);
    const directory = await mkdtemp(join(tmpdir(), "friend-ts-"));
    try {
        const files = sources.map((_, index) => `cell-${index + 1}.ts`);
        await Promise.all(sources.map((source, index) => writeFile(join(directory, files[index]), source)));
        await writeFile(join(directory, "console.d.ts"), declarations);
        await writeFile(join(directory, "tsconfig.json"), JSON.stringify({
            compilerOptions: {
                target: "ES2023", module: "ESNext", moduleResolution: "Bundler", moduleDetection: "legacy", lib: ["ES2023"],
                types: [], strict: true, skipLibCheck: true, noEmitOnError: true,
                noResolve: true, noEmit: checkOnly, outDir: "out", pretty: false,
            },
            files: ["console.d.ts", ...files],
        }));
        const { command, prefix } = await getCompiler();
        try {
            await exec(command, [...prefix, "--project", join(directory, "tsconfig.json")], {
                cwd: directory, timeout: 10_000, maxBuffer: 128 * 1024, signal, windowsHide: true,
            });
        } catch (error) {
            if (signal?.aborted) throw error;
            const diagnostic = String(error.stdout || error.stderr || error.message).replaceAll(directory + "/", "").replaceAll(directory + "\\", "").slice(0, 16_000);
            return { ok: false, error: error.killed ? "Compiler time limit exceeded (10 seconds)." : diagnostic };
        }
        // Coded by OpenAI Codex. Keep declaration-only completion values from echoing the strict directive.
        const javascript = checkOnly ? undefined : (await readFile(join(directory, "out", `cell-${sources.length}.js`), "utf8"))
            .replace(/^"use strict";\r?\n/, '"use strict";\nvoid 0;\n');
        return { ok: true, javascript };
    } finally {
        await rm(directory, { recursive: true, force: true });
    }
}
