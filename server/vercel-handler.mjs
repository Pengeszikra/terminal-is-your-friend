// Coded by OpenAI Codex. HTTPS adapter for the existing compiler and its input limits.
import { compileInput } from "./compiler.mjs";

const maxBodyBytes = 200_000;
let active = 0;

export function createVercelHandler({ checkOnly = false } = {}) {
    return async (request, response) => {
        const send = (status, value) => {
            if (response.destroyed) return;
            response.writeHead(status, {
                "Content-Type": "application/json; charset=utf-8",
                "Cache-Control": "no-store",
                "X-Content-Type-Options": "nosniff",
            });
            response.end(JSON.stringify(value));
        };
        if (request.method !== "POST") {
            response.setHeader("Allow", "POST");
            return send(405, { ok: false, error: "Method not allowed." });
        }
        // Vercel terminates HTTPS. Preview and custom domains use their own request Host.
        if (!request.headers.host || request.headers.origin !== `https://${request.headers.host}` || request.headers["sec-fetch-site"] === "cross-site") {
            return send(403, { ok: false, error: "Same-origin request required." });
        }
        if (request.headers["content-type"]?.split(";")[0].trim().toLowerCase() !== "application/json") {
            return send(415, { ok: false, error: "JSON required." });
        }
        if (Number(request.headers["content-length"]) > maxBodyBytes) return send(413, { ok: false, error: "Request too large." });
        // This is a per-instance concurrency cap, not a global rate limit.
        if (active >= 2) return send(429, { ok: false, error: "Compiler busy. Please try again." });
        active++;
        const controller = new AbortController();
        const onClose = () => { if (!response.writableEnded) controller.abort(); };
        response.on("close", onClose);
        try {
            let body;
            try {
                // Vercel provides a lazily parsed body; its getter can throw on malformed JSON.
                body = request.body;
                if (body === undefined) {
                    const chunks = [];
                    let bytes = 0;
                    for await (const chunk of request) {
                        bytes += Buffer.byteLength(chunk);
                        if (bytes > maxBodyBytes) return send(413, { ok: false, error: "Request too large." });
                        chunks.push(Buffer.from(chunk));
                    }
                    body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
                }
            } catch {
                return send(400, { ok: false, error: "Invalid JSON." });
            }
            if (Buffer.byteLength(JSON.stringify(body)) > maxBodyBytes) return send(413, { ok: false, error: "Request too large." });
            let result;
            try { result = await compileInput(body, { checkOnly, signal: controller.signal }); }
            catch (error) { return send(400, { ok: false, error: error.message }); }
            return send(200, result);
        } catch {
            if (!controller.signal.aborted) return send(500, { ok: false, error: "Compiler request failed." });
        } finally {
            active--;
            response.off("close", onClose);
        }
    };
}
