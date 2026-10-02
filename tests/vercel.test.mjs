// Coded by OpenAI Codex. Exercise Vercel's parsed-body contract with the actual compiler.
import test from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { EventEmitter } from "node:events";
import compile from "../api/compile.js";
import check from "../api/check.js";

async function invoke(handler, { body = { source: "21 |> ((n: number) => n * 2)", history: [] }, method = "POST", headers = {}, raw, malformed = false } = {}) {
    const request = Readable.from(raw === undefined ? [] : [raw]);
    request.method = method;
    request.headers = { host: "terminal-preview.vercel.app", origin: "https://terminal-preview.vercel.app", "content-type": "application/json", ...headers };
    if (malformed) Object.defineProperty(request, "body", { get() { throw new SyntaxError("Invalid JSON"); } });
    else if (raw === undefined) request.body = body;
    const response = new EventEmitter();
    response.destroyed = false;
    response.writableEnded = false;
    response.headers = {};
    response.setHeader = (key, value) => { response.headers[key] = value; };
    response.writeHead = (status, values) => { response.status = status; Object.assign(response.headers, values); };
    response.end = value => { response.body = JSON.parse(value); response.writableEnded = true; };
    await handler(request, response);
    assert.equal(response.listenerCount("close"), 0);
    return response;
}

test("Vercel compile emits pipeline JavaScript and check preserves types without emitting", async () => {
    const compiled = await invoke(compile);
    assert.equal(compiled.status, 200);
    assert.equal(compiled.body.ok, true, compiled.body.error);
    assert.match(compiled.body.javascript, /21/);
    assert.doesNotMatch(compiled.body.javascript, /\|>/);
    assert.equal(compiled.headers["Cache-Control"], "no-store");
    const checked = await invoke(check);
    assert.deepEqual(checked.body, { ok: true });
    const invalid = await invoke(check, { body: { history: ["const double = (n: number) => n * 2;"], source: '"oops" |> double' } });
    assert.equal(invalid.body.ok, false);
    assert.match(invalid.body.error, /not assignable/);
});

test("Vercel functions accept same-origin custom domains and reject other origins and methods", async () => {
    assert.equal((await invoke(check, { headers: { host: "terminal.example.com", origin: "https://terminal.example.com" } })).body.ok, true);
    for (const headers of [{ origin: "https://other.example.com" }, { origin: undefined }, { origin: "http://terminal-preview.vercel.app" }, { "sec-fetch-site": "cross-site" }]) {
        assert.equal((await invoke(compile, { headers })).status, 403);
    }
    const get = await invoke(compile, { method: "GET" });
    assert.equal(get.status, 405);
    assert.equal(get.headers.Allow, "POST");
    assert.equal((await invoke(compile, { headers: { "content-type": "text/plain" } })).status, 415);
});

test("Vercel functions handle parsed and streamed bodies, malformed JSON, and size limits", async () => {
    assert.equal((await invoke(check, { raw: JSON.stringify({ source: "42", history: [] }) })).body.ok, true);
    assert.equal((await invoke(compile, { malformed: true })).status, 400);
    assert.equal((await invoke(compile, { raw: "{" })).status, 400);
    assert.equal((await invoke(compile, { body: null })).status, 400);
    assert.equal((await invoke(compile, { body: { source: "x".repeat(8193), history: [] } })).status, 400);
    assert.equal((await invoke(compile, { body: { source: "x".repeat(200_001), history: [] } })).status, 413);
    assert.equal((await invoke(compile, { raw: "x".repeat(200_001) })).status, 413);
    assert.equal((await invoke(compile, { headers: { "content-length": "200001" } })).status, 413);
});

test("compile and check share an instance concurrency cap and release it after completion", async () => {
    const responses = await Promise.all([invoke(compile), invoke(check), invoke(compile)]);
    assert.deepEqual(responses.map(response => response.status), [200, 200, 429]);
    assert.equal((await invoke(check)).status, 200);
});
