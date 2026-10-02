// Coded by OpenAI Codex. The fork handles TypeScript; esbuild bundles emitted JavaScript only.
import { execFileSync } from "node:child_process";
import { mkdir, rm, copyFile } from "node:fs/promises";
import { join } from "node:path";
import { build } from "esbuild";
import { createRequire } from "node:module";
import { getCompiler, root } from "../server/compiler.mjs";

const { command, prefix } = await getCompiler();
const require = createRequire(import.meta.url);
await rm(join(root, ".compiled"), { recursive: true, force: true });
await rm(join(root, "dist"), { recursive: true, force: true });
await mkdir(join(root, "dist"), { recursive: true });
execFileSync(command, [...prefix, "--project", join(root, "tsconfig.json")], { cwd: root, stdio: "inherit" });
await build({
    entryPoints: [join(root, ".compiled/main.js"), join(root, ".compiled/worker.js")],
    outdir: join(root, "dist"), bundle: true, format: "esm", platform: "browser", target: "es2022",
    loader: { ".wasm": "file" }, assetNames: "[name]-[hash]", logLevel: "info",
    banner: { js: "// Application code by OpenAI Codex. Bundled dependencies retain their own licenses." },
});
execFileSync(process.execPath, [join(root, "node_modules/@tailwindcss/cli/dist/index.mjs"), "-i", "src/styles.css", "-o", "dist/styles.css", "--minify"], { cwd: root, stdio: "inherit" });
await copyFile(join(root, "index.html"), join(root, "dist/index.html"));
await copyFile(join(root, "favicon.svg"), join(root, "dist/favicon.svg"));
await copyFile(require.resolve("@jitl/quickjs-wasmfile-release-sync/wasm"), join(root, "dist/emscripten-module.wasm"));
console.log("Built with the pipeline TypeScript fork + Tailwind.");
