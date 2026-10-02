// Coded by OpenAI Codex. Shared local/Vercel HTTP adapter for explicit instructor questions.
import { askInstructor, InstructorError } from "./instructor.mjs";

export function createInstructorHandler({ protocol = "https", ask = askInstructor } = {}) {
    let active = 0;
    return async (request, response) => {
        const send = (status, value) => {
            if (response.destroyed) return;
            response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
            response.end(JSON.stringify(value));
        };
        if (request.method !== "POST") {
            response.setHeader("Allow", "POST");
            return send(405, { ok: false, error: "Method not allowed." });
        }
        if (!request.headers.host || request.headers.origin !== `${protocol}://${request.headers.host}` || request.headers["sec-fetch-site"] === "cross-site") {
            return send(403, { ok: false, error: "Same-origin request required." });
        }
        if (request.headers["content-type"]?.split(";")[0].trim().toLowerCase() !== "application/json") return send(415, { ok: false, error: "JSON required." });
        if (Number(request.headers["content-length"]) > 64_000) return send(413, { ok: false, error: "Request too large." });
        if (active >= 2) return send(429, { ok: false, error: "The instructor is busy. Please try again." });
        active++;
        const controller = new AbortController();
        const onClose = () => { if (!response.writableEnded) controller.abort(); };
        response.on("close", onClose);
        try {
            let body;
            try {
                body = request.body;
                if (body === undefined) {
                    const chunks = [];
                    let bytes = 0;
                    for await (const chunk of request) {
                        bytes += Buffer.byteLength(chunk);
                        if (bytes > 64_000) return send(413, { ok: false, error: "Request too large." });
                        chunks.push(Buffer.from(chunk));
                    }
                    body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
                }
            } catch { return send(400, { ok: false, error: "Invalid JSON." }); }
            if (Buffer.byteLength(JSON.stringify(body)) > 64_000) return send(413, { ok: false, error: "Request too large." });
            return send(200, await ask(body, { signal: controller.signal }));
        } catch (error) {
            return send(error instanceof InstructorError ? error.status : 500, { ok: false, error: error instanceof InstructorError ? error.message : "Instructor request failed." });
        } finally {
            active--;
            response.off("close", onClose);
        }
    };
}
