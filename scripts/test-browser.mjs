// Coded by OpenAI Codex. Optional end-to-end checks; install Chromium with npx playwright install chromium.
import { checkInstructor } from "./check-instructor-browser.mjs";
import { checkViews } from "./check-views-browser.mjs";
import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { createApp } from "../server/index.mjs";

const app = createApp();
await new Promise(resolve => app.listen(0, "127.0.0.1", resolve));
const browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
try {
    const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
    await page.emulateMedia({ reducedMotion: "reduce" });
    const failures = [];
    page.on("pageerror", error => failures.push(error.message));
    const base = `http://127.0.0.1:${app.address().port}`;
    // Coded by OpenAI Codex. Mock the instructor endpoint; code still uses the real compiler.
    const requests = [];
    const questions = [];
    let releaseReply;
    let delayReply = false;
    let instructorFails = false;
    await page.route("**/api/instructor", async route => {
        const request = route.request().postDataJSON();
        requests.push(request);
        if (request.kind === "question") questions.push(request);
        if (delayReply) await new Promise(resolve => { releaseReply = resolve; });
        await route.fulfill({ status: instructorFails ? 503 : 200, contentType: "application/json", body: JSON.stringify(instructorFails
            ? { ok: false, error: "The instructor is not configured yet." }
            : { ok: true, answer: "The pipeline passes the left value to the function on the right. The result here is 42, and <img src=x> is plain text.", learnerTask: "", code: 'const example = "<img src=x>";\n21 |> ((n: number) => n * 2)' }) });
    });
    await page.goto(base);
    const input = page.locator("#input");
    await page.waitForFunction(() => !document.querySelector("#input").disabled);

    assert.match(await page.locator("#output").innerText(), /Welcome to TiyF/);
    await page.locator("#clear").click();
    assert.match(await page.locator("h1").innerText(), /^\|>/);

    // Coded by OpenAI Codex.
    const run = async source => {
        await input.fill(source);
        await input.press("Enter");
        await page.waitForFunction(() => !document.querySelector("#input").readOnly && !document.querySelector("#input").disabled);
        return page.locator("#output").innerText();
    };
    assert.match(await run("const twice = (n: number) => n * 2;"), /undefined/);
    assert.match(await run("21 |> twice"), /42/);
    await input.press("ArrowUp");
    assert.equal(await input.inputValue(), "21 |> twice");
    await input.press("ArrowUp");
    assert.equal(await input.inputValue(), "const twice = (n: number) => n * 2;");
    await input.press("ArrowDown");
    await input.press("ArrowDown");
    assert.equal(await input.inputValue(), "");

    await input.fill("const answer = 40;");
    await input.press("End");
    await input.press("Shift+Enter");
    await input.pressSequentially("answer + 2");
    assert.equal(await input.inputValue(), "const answer = 40;\nanswer + 2");
    await input.press("Enter");
    await page.waitForFunction(() => !document.querySelector("#input").readOnly);
    assert.equal(await page.locator(".entry-result").last().innerText(), "←\n42");

    // Coded by OpenAI Codex. Colour feedback must not append diagnostics before Enter.
    const before = await page.locator("#output").innerText();
    await input.fill('"oops" |> twice');
    await page.locator(".editor.has-errors").waitFor();
    assert.equal(await page.locator("#output").innerText(), before);
    await input.press("Enter");
    await page.waitForFunction(() => !document.querySelector("#input").readOnly);
    assert.match(await page.locator(".entry-error").last().innerText(), /not assignable/);
    await page.locator(".entry-answer").first().waitFor();
    assert.equal(requests.at(-1).kind, "error");
    assert.equal(requests.at(-1).phase, "compile");
    assert.equal(requests.at(-1).source, '"oops" |> twice');
    assert.match(requests.at(-1).error, /not assignable/);
    assert.match(await run("answer"), /40/);

    assert.equal(questions.length, 0);
    const commandCount = await page.locator(".entry-command").count();
    await input.fill("// Why did my code fail?");
    await page.waitForTimeout(850);
    assert.equal(await page.locator(".editor.has-errors").count(), 0);
    assert.equal(questions.length, 0);
    await input.press("Enter");
    await page.waitForFunction(() => !document.querySelector("#input").readOnly);
    assert.equal(questions.length, 1);
    assert.equal(questions[0].question, "Why did my code fail?");
    assert.ok(questions[0].context.some(entry => entry.kind === "error" && entry.text.includes("not assignable")));
    assert.equal(await page.locator(".entry-command").count(), commandCount);
    assert.match(await page.locator(".entry-answer").last().innerText(), /pipeline/);
    assert.equal(await page.locator("#output img").count(), 0);
    assert.ok(await page.locator(".entry-answer .instructor-code .tok-keyword").count() > 0);
    assert.match(await page.locator(".entry-answer .instructor-code").last().innerText(), /const example/);
    await input.press("ArrowUp");
    assert.equal(await input.inputValue(), "// Why did my code fail?");
    await run("// This is a normal code comment\nanswer + 2");
    assert.equal(questions.length, 1);
    assert.equal(await page.locator(".entry-result").last().innerText(), "←\n42");
    instructorFails = true;
    await run("// What is the capital of France?");
    assert.match(await page.locator(".entry-error").last().innerText(), /not configured/);
    await run("answer");
    assert.equal(await page.locator(".entry-result").last().innerText(), "←\n40");
    instructorFails = false;

    // Coded by OpenAI Codex. Clear cancels delayed AI output, without changing the draft or variables.
    delayReply = true;
    await input.fill("// Show me an example.");
    await input.press("Enter");
    while (!releaseReply) await new Promise(resolve => setTimeout(resolve, 10));
    await page.keyboard.press("Control+l");
    releaseReply();
    delayReply = false;
    await page.waitForFunction(() => !document.querySelector("#input").readOnly);
    assert.equal(await page.locator("#output").innerText(), "");
    await input.fill("answer + 2");
    await page.keyboard.press("Control+l");
    assert.equal(await input.inputValue(), "answer + 2");
    await input.press("Enter");
    await page.waitForFunction(() => !document.querySelector("#input").readOnly);
    assert.equal(await page.locator(".entry-result").last().innerText(), "←\n42");

    // Coded by OpenAI Codex. Type-check bypass still cannot expose browser globals.
    assert.match(await run('(globalThis as any).window'), /undefined/);
    assert.match(await run('console.log.constructor("return typeof fetch")()'), /undefined/);
    assert.match(await run('"<img src=x onerror=alert(1)>"'), /<img/);
    assert.equal(await page.locator("#output img").count(), 0);

    // Coded by OpenAI Codex. Oversized paste is rejected whole and leaves the draft intact.
    await input.fill("42");
    await input.evaluate(element => {
        const data = new DataTransfer();
        data.setData("text/plain", "x".repeat(9000));
        element.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }));
    });
    assert.equal(await input.inputValue(), "42");
    assert.match(await page.locator("#status").innerText(), /Paste rejected/);

    const longSource = "/*" + "x".repeat(2000) + '*/\nthrow new Error("example runtime failure")';
    const previousAnswers = await page.locator(".entry-answer").count();
    await run(longSource);
    await page.waitForFunction(count => document.querySelectorAll(".entry-answer").length > count, previousAnswers);
    assert.equal(requests.at(-1).source, longSource);
    assert.equal(requests.at(-1).phase, "runtime");
    assert.match(requests.at(-1).error, /example runtime failure/);
    assert.match(await run("while (true) {}"), /time limit/);
    assert.match(await run("21 |> ((n: number) => n * 2)"), /42/);
    assert.match(await run("answer"), /Cannot find name/);
    await page.locator("#reset").click();
    await page.waitForFunction(() => !document.querySelector("#input").disabled);
    await run("// What can I try next?");
    assert.ok(questions.at(-1).context.every(entry => entry.kind === "note"));
    await page.locator("#clear").click();
    await run("const double = (n: number) => n * 2;");
    await run("[1, 2, 3] |> ((values: number[]) => values.map(double))");
    await run("21 |> double");
    await mkdir("test-results", { recursive: true });
    await run("// Explain this pipeline.");
    await page.screenshot({ path: "test-results/terminal-desktop.png" });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: "test-results/terminal-mobile.png" });
    await checkViews(page, run);
    assert.deepEqual(failures, []);

    await checkInstructor(browser, base);
    console.log("Browser checks passed: instant greeting, proactive task-aware instructor, pipeline, state, input/history, diagnostics, typewriter/highlighted AI code, cancellation, isolation, views, desktop and mobile (mock AI API).");
} finally {
    await browser.close();
    await new Promise(resolve => app.close(resolve));
}
