// Coded by OpenAI Codex. Optional end-to-end checks; install Chromium with npx playwright install chromium.
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
    const failures = [];
    page.on("pageerror", error => failures.push(error.message));
    const base = `http://127.0.0.1:${app.address().port}`;
    await page.goto(base);
    const input = page.locator("#input");
    await page.waitForFunction(() => !document.querySelector("#input").disabled);

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
    assert.match(await run("answer"), /40/);

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

    assert.match(await run("while (true) {}"), /time limit/);
    assert.match(await run("21 |> ((n: number) => n * 2)"), /42/);
    assert.match(await run("answer"), /Cannot find name/);
    await page.locator("#reset").click();
    await page.waitForFunction(() => !document.querySelector("#input").disabled);
    await page.locator("#clear").click();
    await run("const double = (n: number) => n * 2;");
    await run("[1, 2, 3] |> ((values: number[]) => values.map(double))");
    await run("21 |> double");
    await mkdir("test-results", { recursive: true });
    await page.screenshot({ path: "test-results/terminal-desktop.png" });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: "test-results/terminal-mobile.png" });
    assert.deepEqual(failures, []);
    console.log("Browser checks passed: pipeline, state, Shift+Enter, history, silent error palette, diagnostics, isolation, HTML escaping, paste limit, timeout recovery, desktop and mobile.");
} finally {
    await browser.close();
    await new Promise(resolve => app.close(resolve));
}
