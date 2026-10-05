// Coded by OpenAI Codex. Real service worker and compiler; no provider calls.
import assert from "node:assert/strict";

export async function checkPWA(browser, base) {
    const context = await browser.newContext({ reducedMotion: "reduce" });
    const page = await context.newPage();
    let mode = "hang";
    let calls = 0;
    let release;
    await page.route("**/api/instructor", async route => {
        calls++;
        if (mode === "hang") await new Promise(resolve => { release = resolve; });
        if (mode === "network") return route.abort();
        await route.fulfill({ status: mode === "http" ? 503 : 200,
            contentType: "application/json", body: mode === "malformed" ? "not json" : JSON.stringify({
                ok: mode !== "http", answer: "Ready to help again.", learnerTask: "",
            }) });
    });
    try {
        await page.goto(base);
        await page.locator('#input:not([disabled])').waitFor();
        await page.evaluate(() => navigator.serviceWorker.ready);
        await page.waitForFunction(() => !!navigator.serviceWorker.controller);
        const manifest = await (await page.request.get(`${base}/manifest.webmanifest`)).json();
        assert.equal(manifest.display, "standalone");
        assert.deepEqual(manifest.icons.map(icon => icon.sizes), ["192x192", "512x512"]);
        for (const icon of manifest.icons) {
            assert.equal((await page.request.get(base + icon.src)).headers()["content-type"], "image/png");
        }
        const input = page.locator('#input');
        const question = async () => {
            release = undefined;
            const before = calls;
            await input.fill('// Help me');
            await input.press('Enter');
            await page.waitForFunction(() => !document.querySelector('#input').readOnly);
            for (let i = 0; calls === before && i < 100; i++) await new Promise(resolve => setTimeout(resolve, 10));
            assert.ok(calls > before);
        };
        const run = async source => {
            await input.fill(source);
            await input.press('Enter');
            await page.waitForFunction(() => !document.querySelector('#input').readOnly);
        };
        await question();
        assert.equal(await page.locator('#reset').isEnabled(), true);
        await run('const twice = (n: number) => n * 2; 21 |> twice');
        assert.match(await page.locator('.entry-result').last().innerText(), /42/);
        release();
        await page.locator('#clear').click();
        for (const failure of ['http', 'malformed', 'network']) {
            mode = failure;
            await question();
            await page.locator('#mentor-status').filter({ hasText: 'unavailable' }).waitFor();
            const before = calls;
            await run('throw new Error("ordinary code error")');
            assert.equal(calls, before, 'Code errors do not retry an unavailable mentor');
            await run('21 |> ((n: number) => n * 2)');
            assert.match(await page.locator('.entry-result').last().innerText(), /42/);
        }
        // A real pending fetch times out without ever disabling the terminal.
        await page.clock.install();
        mode = 'hang';
        await question();
        await page.clock.fastForward(25_001);
        await page.locator('#mentor-status').filter({ hasText: 'unavailable' }).waitFor();
        assert.equal(await input.isEditable(), true);
        release();
        mode = 'ok';
        await question();
        await page.locator('.entry-answer').filter({ hasText: 'Ready to help again' }).waitFor();
        assert.equal(await page.locator('#mentor-status').isHidden(), true);
        await run('return <view><button onClick={() => <view>offline click works</view>}>test offline</button></view>');
        await page.locator('#program-screen button').waitFor();
        await context.setOffline(true);
        await page.locator('#network-status').waitFor();
        await page.locator('#program-screen button').click();
        await page.locator('#program-screen').filter({ hasText: 'offline click works' }).waitFor();
        await input.fill('40 + 2');
        await input.press('Enter');
        assert.equal(await input.inputValue(), '40 + 2', 'Offline compile retains the draft');
        assert.match(await page.locator('#status').innerText(), /reconnect/);
        await page.reload();
        await page.locator('#input:not([disabled])').waitFor();
        await page.locator('#network-status').waitFor();
        assert.equal(await input.isEditable(), true, 'Cached shell and sandbox start offline');
        assert.equal(await page.evaluate(async () => {
            const keys = await caches.keys();
            const urls = await Promise.all(keys.filter(key => key.startsWith('tiyf-shell-')).map(async key =>
                (await (await caches.open(key)).keys()).map(request => request.url)));
            return urls.flat().some(url => url.includes('/api/'));
        }), false, 'API requests are never cached');
        await context.setOffline(false);
        await page.locator('#network-status').waitFor({ state: 'hidden' });
        await run('21 |> ((n: number) => n * 2)');
        assert.match(await page.locator('.entry-result').last().innerText(), /42/);
        await page.screenshot({ path: 'test-results/pwa-mentor-resilience.png' });
        console.log('PWA checks passed: manifest/icons, shell and WASM offline reload, retained offline draft, live offline controls, hung/failed/malformed mentor, timeout, retry, reconnection, no API caching.');
    } finally { await context.close(); }
}
