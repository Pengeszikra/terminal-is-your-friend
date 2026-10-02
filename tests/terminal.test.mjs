// Coded by OpenAI Codex. Tests use the actual published fork and the actual QuickJS sandbox.
import test from "node:test";
import assert from "node:assert/strict";
import { compileInput, validateInput } from "../server/compiler.mjs";
import { createSandbox } from "../.compiled/sandbox.js";
import { createApp } from "../server/index.mjs";

// Coded by OpenAI Codex.
test("pipeline, type changes and persistent state without replay", async () => {
    const output = [];
    const sandbox = await createSandbox(value => output.push(value));
    const history = [];
    try {
        for (const [source, expected] of [
            ["let calls = 0; const twice = (n: number) => { calls++; return n * 2; };", "undefined"],
            ["21 |> twice", "42"],
            ["calls", "1"],
            ['[1, 2, 3] |> ((xs: number[]) => xs.map(twice)) |> ((xs: number[]) => xs.reduce((a, b) => a + b, 0)) |> ((n: number) => `sum=${n}`)', '"sum=12"'],
            ["calls", "4"],
        ]) {
            const compiled = await compileInput({ source, history });
            assert.equal(compiled.ok, true, compiled.error);
            const result = sandbox.evaluate(compiled.javascript);
            assert.equal(result.ok, true, result.error);
            assert.equal(result.value, expected);
            history.push(source);
        }
        const invalid = await compileInput({ source: '"oops" |> twice', history });
        assert.equal(invalid.ok, false);
        assert.match(invalid.error, /not assignable/);
        assert.equal(sandbox.evaluate("calls").value, "4");
    } finally { sandbox.dispose(); }
});

// Coded by OpenAI Codex.
test("compiler reports syntax errors and unavailable browser globals", async () => {
    for (const source of ["const broken = ;", "window.location", "document.cookie", "fetch('https://example.com')", "process.env", 'import data from "node:fs";']) {
        const result = await compileInput({ source, history: [] });
        assert.equal(result.ok, false, source);
        assert.ok(result.error.length > 0);
        assert.ok(!result.error.includes("/tmp/friend-ts-"));
    }
});

// Coded by OpenAI Codex. Runtime isolation must still hold when TypeScript checks are bypassed.
test("guest has no window, DOM, network, storage, Node or worker capabilities", async () => {
    const sandbox = await createSandbox(() => {});
    try {
        for (const name of ["window", "document", "parent", "top", "fetch", "XMLHttpRequest", "WebSocket", "Worker", "importScripts", "postMessage", "navigator", "location", "localStorage", "indexedDB", "process", "require", "Deno", "Bun", "setTimeout"]) {
            assert.equal(sandbox.evaluate(`typeof ${name}`).value, '"undefined"', name);
            assert.equal(sandbox.evaluate(`Function('return typeof ${name}')()`).value, '"undefined"', "Function: " + name);
            assert.equal(sandbox.evaluate(`console.log.constructor('return typeof ${name}')()`).value, '"undefined"', "console constructor: " + name);
        }
        assert.equal(sandbox.evaluate("globalThis.__friend_probe = 123").ok, true);
        assert.equal(globalThis.__friend_probe, undefined);
        assert.equal(sandbox.evaluate("console.log.constructor === Function").value, "true");
    } finally { sandbox.dispose(); }
});

// Coded by OpenAI Codex.
test("console handles objects, cycles and getters with bounded output", async () => {
    const output = [];
    const sandbox = await createSandbox(value => output.push(value));
    try {
        const result = sandbox.evaluate('const a = { x: 1, get trap() { throw Error("getter executed"); } }; a.self = a; console.log(a); for(let i = 0; i < 1000; i++) console.log(i);');
        assert.equal(result.ok, true, result.error);
        assert.match(output[0].text, /Circular/);
        assert.match(output[0].text, /Getter/);
        assert.equal(output.length, 101);
        assert.match(output.at(-1).text, /truncated/);
    } finally { sandbox.dispose(); }
});

// Coded by OpenAI Codex.
test("runtime errors report their message and reset partial state", async () => {
    const sandbox = await createSandbox(() => {});
    try {
        const result = sandbox.evaluate('let partial = 123; throw new Error("expected failure");');
        assert.equal(result.ok, false);
        assert.match(result.error, /expected failure/);
        assert.equal(result.reset, true);
        assert.equal(sandbox.evaluate("typeof partial").value, '"undefined"');
        assert.equal(sandbox.evaluate("6 * 7").value, "42");
    } finally { sandbox.dispose(); }
});

// Coded by OpenAI Codex.
test("infinite loops stop and the sandbox remains usable", { timeout: 6000 }, async () => {
    const sandbox = await createSandbox(() => {});
    try {
        const start = Date.now();
        const result = sandbox.evaluate("while (true) {}");
        assert.equal(result.ok, false);
        assert.match(result.error, /time limit/);
        assert.ok(Date.now() - start < 4000);
        assert.equal(sandbox.evaluate("40 + 2").value, "42");
    } finally { sandbox.dispose(); }
});

// Coded by OpenAI Codex.
test("memory exhaustion is bounded and recoverable", async () => {
    const sandbox = await createSandbox(() => {});
    try {
        const result = sandbox.evaluate("new ArrayBuffer(64 * 1024 * 1024)");
        assert.equal(result.ok, false);
        assert.match(result.error, /memory|alloc/i);
        assert.equal(sandbox.evaluate("40 + 2").value, "42");
    } finally { sandbox.dispose(); }
});

// Coded by OpenAI Codex.
test("input and history have server-enforced limits", () => {
    assert.throws(() => validateInput({ source: "x".repeat(8193), history: [] }), /8 KB/);
    assert.throws(() => validateInput({ source: "x\n".repeat(100), history: [] }), /100 lines/);
    assert.throws(() => validateInput({ source: "42", history: Array(50).fill("0") }), /50 submissions/);
    assert.throws(() => validateInput({ source: "42", history: Array(20).fill("x".repeat(8000)) }), /Session code limit/);
    assert.throws(() => validateInput({ source: "42", history: [null] }), /8 KB/);
});

// Coded by OpenAI Codex.
test("HTTP compilation works only for the local origin and cannot expose source files", async () => {
    const server = createApp();
    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    try {
        const post = (origin, body) => fetch(`${base}/api/compile`, { method: "POST", headers: { "Content-Type": "application/json", Origin: origin }, body: JSON.stringify(body) });
        assert.equal((await post("https://example.com", { source: "42", history: [] })).status, 403);
        const response = await post(base, { source: "21 |> ((n: number) => n * 2)", history: [] });
        assert.equal(response.status, 200);
        assert.equal((await response.json()).ok, true);
        const page = await fetch(base);
        assert.match(page.headers.get("content-security-policy"), /default-src 'none'/);
        assert.equal((await fetch(`${base}/server/compiler.mjs`)).status, 404);
        assert.equal((await fetch(`${base}/package.json`)).status, 404);
    } finally { await new Promise(resolve => server.close(resolve)); }
});
