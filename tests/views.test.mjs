// Coded by OpenAI Codex. Real fork + QuickJS integration tests for the TSX protocol.
import test from "node:test";
import assert from "node:assert/strict";
import { compileInput } from "../server/compiler.mjs";
import { createSandbox } from "../.compiled/sandbox.js";
import { instructorKnowledge } from "../server/instructor-knowledge.mjs";

async function run(sandbox, source, history = []) {
    const compiled = await compileInput({ source, history });
    assert.equal(compiled.ok, true, compiled.error);
    const result = sandbox.evaluate(compiled.javascript);
    assert.equal(result.ok, true, result.error);
    return result;
}

test("default TSX accepts plain JS, optional parameter types, and still checks explicit types", async () => {
    const sandbox = await createSandbox(() => {});
    try {
        const first = 'const double = n => n * 2; const typed = (n: number) => n * 2;';
        await run(sandbox, first);
        assert.equal((await run(sandbox, '21 |> double', [first])).value, "42");
        assert.equal((await compileInput({ source: 'typed("x")', history: [first] })).ok, false);
        assert.equal((await compileInput({ source: '<view>Hello</view>', history: [], }, { checkOnly: true })).ok, true);
        await run(sandbox, 'let centered = true; <view center={centered}>First</view>; centered = false; <view center={centered}>Second</view>; <view center>Third</view>; <view>Fourth</view>;');
        assert.deepEqual([sandbox.nextFrame().center, sandbox.nextFrame().center, sandbox.nextFrame().center, sandbox.nextFrame().center], [true, false, true, false]);
        const invalidCenter = sandbox.evaluate('__tiyf.jsx("view", {center: "yes"}, "bad")');
        assert.equal(invalidCenter.ok, false);
        assert.match(invalidCenter.error, /center prop must be a boolean/);
        for (const source of ['<view center="yes">no</view>', '<div>no</div>', '<button onClick={() => 1} />', '<input onInput={n => n.toFixed()} />', '<view style="color:red">no</view>', '<button onPress={() => 1}>No</button>']) {
            assert.equal((await compileInput({ source, history: [] })).ok, false, source);
        }
    } finally { sandbox.dispose(); }
});

test("countdown snapshots queue in order, with a separate explicit return and no replay", async () => {
    const sandbox = await createSandbox(() => {});
    try {
        const source = 'const render = content => <view>{content}</view>; for (let frame = 0; frame < 100; frame++) { 100 - frame |> render; } return "counting";';
        assert.equal((await run(sandbox, source)).value, '"counting"');
        for (let n = 100; n > 0; n--) assert.deepEqual(sandbox.nextFrame().children, [String(n)]);
        assert.equal(sandbox.nextFrame(), undefined);
        await run(sandbox, 'render(42)', [source]);
        assert.deepEqual(sandbox.nextFrame().children, ['42']);
        assert.equal(sandbox.nextFrame(), undefined);
    } finally { sandbox.dispose(); }
});

test("view whitespace is literal; returns inside arrows and strings are untouched", async () => {
    const sandbox = await createSandbox(() => {});
    try {
        assert.equal((await run(sandbox, 'const f = () => { return "return"; }; <view>\n\n\n          {f()} &amp; TSX\n\n\n</view>; return f();')).value, '"return"');
        assert.deepEqual(sandbox.nextFrame().children, ['\n\n\n          ', 'return', ' & TSX\n\n\n']);
        assert.equal((await run(sandbox, 'return;')).value, 'undefined');
        for (const binding of ['(error)', '({message}: any)', '']) {
            assert.equal((await run(sandbox, `try { return 42; } catch ${binding} { throw Error("return was caught"); } finally { <view>finally</view>; }`)).value, '42');
            assert.deepEqual(sandbox.nextFrame().children, ['finally']);
        }
        assert.equal((await run(sandbox, 'if (true) return 42; throw Error("unreachable");')).value, '42');
    } finally { sandbox.dispose(); }
});

test("click and input callbacks receive primitive arguments, update state and ignore stale controls", async () => {
    const logs = [];
    const sandbox = await createSandbox(item => logs.push(item));
    try {
        await run(sandbox, 'let name = ""; <view><input onInput={value => { name = value; }} /><button onClick={() => { console.log(name); <view>Hello, {name}</view>; }}>Done</button></view>;');
        const first = sandbox.nextFrame();
        const input = first.children[0], button = first.children[1];
        assert.equal(sandbox.dispatch({ kind: 'input', id: input.id, value: '<img src=x>', frame: first.id }).ok, true);
        assert.equal(sandbox.nextFrame(), undefined, 'Typing must not implicitly replace the frame');
        assert.equal(sandbox.dispatch({ kind: 'click', id: button.id, value: '', frame: first.id }).ok, true);
        assert.deepEqual(sandbox.nextFrame().children, ['Hello, ', '<img src=x>']);
        assert.equal(logs.length, 1);
        sandbox.dispatch({ kind: 'click', id: button.id, value: '', frame: first.id });
        assert.equal(logs.length, 1, 'Removed buttons cannot fire');
        assert.equal(sandbox.nextFrame(), undefined);
    } finally { sandbox.dispose(); }
});

test("standalone keyboard listener survives frame replacement and clear but not reset", async () => {
    const logs = [];
    const sandbox = await createSandbox(item => logs.push(item));
    try {
        await run(sandbox, '<button onPress={key => { console.log(key); <view>{key}</view>; }} />; <view>First</view>; <view>Second</view>;');
        sandbox.nextFrame(); sandbox.nextFrame();
        sandbox.clearViews();
        assert.equal(sandbox.dispatch({ kind: 'key', id: 0, value: 'ArrowRight', frame: 0 }).ok, true);
        assert.deepEqual(sandbox.nextFrame().children, ['ArrowRight']);
        sandbox.reset();
        sandbox.dispatch({ kind: 'key', id: 0, value: 'ArrowLeft', frame: 0 });
        assert.equal(logs.length, 1);
    } finally { sandbox.dispose(); }
});

test("callback failure and resource limits reset all runtime state and pending frames", async () => {
    const sandbox = await createSandbox(() => {});
    try {
        await run(sandbox, 'let partial = 1; <view><button onClick={() => { while (true) {} }}>Hang</button></view>;');
        const frame = sandbox.nextFrame();
        const result = sandbox.dispatch({ kind: 'click', id: frame.children[0].id, value: '', frame: frame.id });
        assert.equal(result.reset, true);
        assert.match(result.error, /time limit/);
        assert.equal(sandbox.evaluate('typeof partial').value, '"undefined"');
        assert.equal(sandbox.nextFrame(), undefined);
        const compiled = await compileInput({ source: 'for(let i=0;i<1001;i++) <view>{i}</view>;', history: [] });
        const overflow = sandbox.evaluate(compiled.javascript);
        assert.equal(overflow.reset, true);
        assert.match(overflow.error, /queue limit/);
        assert.equal(sandbox.nextFrame(), undefined);
        const bypass = sandbox.evaluate('__tiyf.jsx("img", {src:"https://example.com"})');
        assert.equal(bypass.reset, true);
        assert.match(bypass.error, /Only/);
    } finally { sandbox.dispose(); }
});

test("all knowledge-base examples compile and run with the documented sandbox APIs", async () => {
    const examples = [...instructorKnowledge.matchAll(/Example \(fresh session\):\n([\s\S]*?)(?=\n\n|\nThis |\nThe first)/g)].map(match => match[1]);
    assert.equal(examples.length, 4);
    for (const source of examples) {
        const sandbox = await createSandbox(() => {});
        try { await run(sandbox, source); assert.ok(sandbox.nextFrame()); }
        finally { sandbox.dispose(); }
    }
});
