// Coded by OpenAI Codex. Local-only HTTP service; submitted programs never run in Node.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { compileInput, getCompiler, root } from "./compiler.mjs";
import { createInstructorHandler } from "./instructor-handler.mjs";

const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".wasm": "application/wasm" };
const securityHeaders = {
    "Content-Security-Policy": "default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self'; worker-src 'self'; connect-src 'self'; img-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Cache-Control": "no-store",
};

// Coded by OpenAI Codex.
export function createApp() {
    let active = 0;
    const instructor = createInstructorHandler({ protocol: "http" });
    return createServer(async (request, response) => {
        const host = request.headers.host;
        const port = request.socket.localPort;
        const hosts = [`localhost:${port}`, `127.0.0.1:${port}`];
        const send = (status, value) => {
            if (response.destroyed) return;
            response.writeHead(status, { ...securityHeaders, "Content-Type": "application/json; charset=utf-8" });
            response.end(JSON.stringify(value));
        };
        if (!hosts.includes(host)) return send(403, { error: "Invalid local host." });
        if (request.headers["sec-fetch-site"] === "cross-site") return send(403, { error: "Cross-site requests are disabled." });
        const pathname = new URL(request.url, `http://${host}`).pathname;
        if (pathname === "/api/instructor") return instructor(request, response);
        if (request.method === "POST" && ["/api/compile", "/api/check"].includes(pathname)) {
            if (request.headers.origin !== `http://${host}`) return send(403, { error: "Same-origin request required." });
            if (!request.headers["content-type"]?.startsWith("application/json")) return send(415, { error: "JSON required." });
            if (active >= 2) return send(429, { error: "Compiler busy. Please try again." });
            active++;
            const controller = new AbortController();
            response.on("close", () => { if (!response.writableEnded) controller.abort(); });
            try {
                const chunks = [];
                let bytes = 0;
                for await (const chunk of request) {
                    bytes += chunk.length;
                    if (bytes > 200_000) { send(413, { error: "Request too large." }); return; }
                    chunks.push(chunk);
                }
                let body;
                try { body = JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { return send(400, { error: "Invalid JSON." }); }
                let result;
                try { result = await compileInput(body, { checkOnly: pathname === "/api/check", signal: controller.signal }); }
                catch (error) { return send(400, { ok: false, error: error.message }); }
                send(200, result);
            } catch (error) {
                if (!controller.signal.aborted) send(500, { error: "Compiler request failed." });
            } finally { active--; }
            return;
        }
        if (request.method !== "GET") return send(405, { error: "Method not allowed." });
        // Coded by OpenAI Codex. Only flat build assets are served; no arbitrary filesystem paths.
        const asset = pathname === "/" ? "index.html" : pathname.slice(1);
        if (!/^[a-zA-Z0-9_.-]+$/.test(asset) || !mime[extname(asset)]) return send(404, { error: "Not found." });
        try {
            const content = await readFile(resolve(root, "dist", asset));
            response.writeHead(200, { ...securityHeaders, "Content-Type": mime[extname(asset)] });
            response.end(content);
        } catch { send(404, { error: "Not found. Run npm run build first." }); }
    });
}

// Coded by OpenAI Codex.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    await getCompiler();
    const port = Number(process.env.PORT || 5173);
    const app = createApp();
    app.listen(port, "127.0.0.1", () => console.log(`Terminal Is Your Friend → http://localhost:${port}`));
    app.on("error", error => { console.error(error.message); process.exitCode = 1; });
}
