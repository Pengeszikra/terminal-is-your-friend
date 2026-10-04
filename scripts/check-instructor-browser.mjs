// Coded by OpenAI Codex. Virtual time exercises scheduling without waiting minutes or calling Groq.
import assert from "node:assert/strict";

export async function checkInstructor(browser, base) {
    const page = await browser.newPage();
    await page.addInitScript(() => { Math.random = () => 0.5; });
    await page.clock.install({ time: new Date("2026-10-03T00:00:00Z") });
    await page.clock.pauseAt(new Date("2026-10-03T00:00:01Z"));
    const requests = [];
    let release;
    let delayed = false;
    let fail = false;
    await page.route("**/api/instructor", async route => {
        const data = route.request().postDataJSON();
        requests.push(data);
        if (delayed) await new Promise(resolve => { release = resolve; });
        let learnerTask = "";
        if (data.question?.includes("task") || (data.kind === "review" && data.result !== "42")) learnerTask = "Compute 40 + 2.";
        await route.fulfill({ status: fail ? 503 : 200, json: fail ? { ok: false, error: "Instructor unavailable." } : {
            ok: true, learnerTask,
            language: data.question?.includes('magyarul') ? 'hu' : data.language ?? 'en',
            answer: data.kind === "review" ? "I checked the result against our exercise. We can decide what comes next." : "Let us look at a value from another angle. How might a useful name make its purpose easier to see?",
            code: 'const label = "<img src=x>";',
        } });
    });
    try {
        await page.goto(base);
        const input = page.locator('#input');
        await page.locator('#input:not([disabled])').waitFor();
        assert.equal(await input.inputValue(), '');
        assert.equal(await input.getAttribute('placeholder'), null, 'The empty editor has no example behind the cursor');
        const greeting = page.locator('.entry-answer').first();
        const initial = await greeting.innerText();
        assert.ok(initial.length > 2 && initial.length < 100, 'Greeting starts immediately and is progressively typed');
        assert.equal(requests.length, 0, 'The instant greeting requires no network request');
        await page.clock.runFor(200);
        assert.ok((await greeting.innerText()).length > initial.length);
        await page.clock.runFor(6000);
        assert.match(await greeting.innerText(), /Have you programmed before/);
        assert.equal(await page.locator('[aria-busy="true"]').count(), 0);

        await input.fill('42');
        await page.clock.runFor(60000);
        assert.equal(requests.length, 0, 'A draft suppresses proactive requests');
        await input.fill('');
        await page.clock.runFor(19000);
        assert.equal(requests.length, 0);
        await page.clock.runFor(1000);
        await page.waitForFunction(() => document.querySelectorAll('.entry-answer').length === 2);
        assert.equal(requests[0].kind, 'idle');
        assert.equal(requests[0].idleTurn, 0);
        assert.ok(requests[0].context.some(entry => entry.text.includes('Welcome to TiyF')));
        assert.ok((await page.locator('.entry-answer').last().innerText()).length < 100);
        await page.clock.runFor(6000);
        assert.ok(await page.locator('.instructor-code .tok-keyword').count() > 0);
        assert.equal(await page.locator('#output img').count(), 0);
        await input.press('ArrowLeft');
        await page.clock.runFor(20000);
        await page.waitForFunction(() => document.querySelectorAll('.entry-answer').length === 3);
        assert.equal(requests[1].idleTurn, 1, 'Idle conversation repeats with a new angle');
        await page.clock.runFor(6000);

        const submit = async source => {
            const before = requests.length;
            await input.fill(source);
            await input.press('Enter');
            // A network response arrives on real I/O even while browser time is paused.
            await page.locator('.entry-answer[aria-busy="true"]').waitFor();
            await page.clock.runFor(6000);
            await page.waitForFunction(() => !document.querySelector('#input').readOnly);
            assert.ok(requests.length > before);
        };
        await submit('// Give me a task');
        const count = requests.length;
        await page.clock.runFor(60000);
        assert.equal(requests.length, count, 'Pending exercises suppress all idle chatter');
        await page.keyboard.press('Control+l');
        await page.clock.runFor(60000);
        assert.equal(requests.length, count, 'Clear preserves the exercise');
        await submit('1 + 1');
        assert.equal(requests.at(-1).kind, 'review');
        assert.equal(requests.at(-1).learnerTask, 'Compute 40 + 2.');
        await page.clock.runFor(60000);
        assert.equal(requests.length, count + 1, 'An incomplete attempt preserves the task');
        await submit('40 + 2');
        assert.equal(requests.at(-1).result, '42');
        await input.press('ArrowLeft');
        await page.clock.runFor(20000);
        await page.locator('.entry-answer[aria-busy="true"]').waitFor();
        assert.equal(requests.at(-1).kind, 'idle', 'Completed exercises allow conversation again');
        await page.clock.runFor(6000);

        // User activity aborts an in-flight unsolicited response without changing a draft.
        delayed = true;
        await input.press('ArrowLeft');
        await page.clock.runFor(20000);
        for (let tries = 0; !release && tries < 100; tries++) await new Promise(resolve => setTimeout(resolve, 10));
        assert.ok(release, "The delayed idle request started");
        const before = await page.locator('#output').innerText();
        await input.fill('draft');
        release();
        delayed = false;
        await page.clock.runFor(6000);
        assert.equal(await input.inputValue(), 'draft');
        assert.equal(await page.locator('#output').innerText(), before);

        await input.fill('');
        await page.evaluate(() => {
            Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
            document.dispatchEvent(new Event('visibilitychange'));
        });
        const hiddenCount = requests.length;
        await page.clock.runFor(60000);
        assert.equal(requests.length, hiddenCount);
        await page.evaluate(() => {
            Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
            document.dispatchEvent(new Event('visibilitychange'));
        });
        fail = true;
        await page.clock.runFor(20000);
        await page.locator('.entry-error').filter({ hasText: 'Instructor unavailable' }).waitFor();
        const failureCount = requests.length;
        await page.clock.runFor(60000);
        assert.equal(requests.length, failureCount, 'Provider failure pauses automatic retries');
        fail = false;
        await submit('// Magyarázd el magyarul');
        await input.press('ArrowLeft');
        await page.clock.runFor(20000);
        await page.locator('.entry-answer[aria-busy="true"]').waitFor();
        assert.equal(requests.at(-1).language, 'hu', 'Idle turns preserve the reply language');
        await page.clock.runFor(6000);
        await page.keyboard.press('Control+l');
        await submit('missingVariable');
        assert.equal(requests.at(-1).kind, 'error');
        assert.equal(requests.at(-1).language, 'hu', 'Diagnostics do not reset the reply language');

        // Clear while typing cancels remaining characters as well as the request.
        await input.fill('// Another explanation');
        await input.press('Enter');
        await page.locator('.entry-answer[aria-busy="true"]').waitFor();
        await page.keyboard.press('Control+l');
        await page.clock.runFor(6000);
        assert.equal(await page.locator('#output').innerText(), '');
        await page.locator('#reset').click();
        await page.locator('#input:not([disabled])').waitFor();
        await page.clock.runFor(20000);
        await page.locator('.entry-answer[aria-busy="true"]').waitFor();
        assert.equal(requests.at(-1).learnerTask, '');
        assert.equal(requests.at(-1).language, 'en', 'Reset restores the initial reply language');
        assert.ok(requests.at(-1).context.every(entry => entry.kind === 'note'));
        await page.clock.runFor(6000);
        console.log('Instructor browser checks passed: immediate typewriter greeting, recurring idle turns, drafts, task/review lifecycle, cancellation, hidden tabs, failure backoff, reset and highlighted code.');
    } finally { await page.close(); }
}
