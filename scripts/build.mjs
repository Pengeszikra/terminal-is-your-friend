// Coded by OpenAI Codex. The fork handles TypeScript; esbuild bundles emitted JavaScript only.
import { execFileSync } from "node:child_process";
import { mkdir, rm, copyFile, readFile, writeFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { build } from "esbuild";
import { createRequire } from "node:module";
import { getCompiler, root } from "../server/compiler.mjs";
import { releaseVersion } from "./version.mjs";

const version = releaseVersion(root);
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
const html = await readFile(join(root, "index.html"), "utf8");
await writeFile(join(root, "dist/index.html"), html.replaceAll("__TIYF_VERSION__", version));
await copyFile(join(root, "favicon.svg"), join(root, "dist/favicon.svg"));
await copyFile(require.resolve("@jitl/quickjs-wasmfile-release-sync/wasm"), join(root, "dist/emscripten-module.wasm"));
for (const asset of ["manifest.webmanifest", "icon-192.png", "icon-512.png"]) {
    await copyFile(join(root, asset), join(root, "dist", asset));
}
const assets = (await readdir(join(root, "dist"))).sort();
const hash = createHash("sha256");
for (const asset of assets) hash.update(asset).update(await readFile(join(root, "dist", asset)));
const serviceWorker = await readFile(join(root, "sw.js"), "utf8");
hash.update(serviceWorker);
await writeFile(join(root, "dist/sw.js"), serviceWorker
    .replace("__BUILD_HASH__", hash.digest("hex").slice(0, 16))
    .replace("__PRECACHE_ASSETS__", JSON.stringify(assets.map(asset => `/${asset}`))));
console.log(`Built TiyF ${version} with the pipeline TypeScript fork + Tailwind.`);
