// Coded by OpenAI Codex. Exercise the real compiler, worker, queue, DOM and input lifecycle.
import assert from "node:assert/strict";

export async function checkViews(page, run) {
    const screen = page.locator('#program-screen');
    const editor = page.locator('#input');
    await page.locator('#reset').click();
    await page.waitForFunction(() => !document.querySelector('#input').disabled);
    await page.evaluate(() => {
        globalThis.framesSeen = [];
        new MutationObserver(() => {
            const screen = document.querySelector('#program-screen');
            if (screen.textContent) globalThis.framesSeen.push({ text: screen.textContent, time: performance.now() });
        }).observe(document.querySelector('#program-screen'), { childList: true });
    });
    await run('const render = content => <view>{content}</view>; for(let n=4;n>0;n--) n |> render; return "counting";');
    await page.waitForFunction(() => document.querySelector('#program-screen').textContent === '1');
    const frames = await page.evaluate(() => globalThis.framesSeen);
    assert.deepEqual(frames.map(frame => frame.text), ['4', '3', '2', '1']);
    for(let i=1; i<frames.length; i++) assert.ok(frames[i].time - frames[i-1].time >= 150, 'Frames must play over time, not collapse into the final frame');
    assert.match(await page.locator('.entry-result').last().innerText(), /counting/);
    assert.equal(await screen.locator('code').count(), 1);
    const layout = await screen.evaluate(element => ({ height: element.clientHeight, width: element.getBoundingClientRect().width, line: parseFloat(getComputedStyle(element.firstChild).lineHeight), whitespace: getComputedStyle(element.firstChild).whiteSpace }));
    assert.ok(Math.abs(layout.height - 7 * layout.line) <= 1);
    assert.equal(layout.whitespace, 'pre');
    assert.equal(await screen.evaluate(element => element.parentElement.id), 'output');
    const scrollMovement = await page.locator('#terminal').evaluate(element => {
        element.scrollTop = 0;
        const before = document.querySelector('#program-screen').getBoundingClientRect().top;
        element.scrollTop = 80;
        return { scroll: element.scrollTop, movement: before - document.querySelector('#program-screen').getBoundingClientRect().top };
    });
    assert.ok(scrollMovement.scroll > 0);
    assert.ok(Math.abs(scrollMovement.movement - scrollMovement.scroll) < 1, 'The view scrolls with terminal entries');
    await run('<view center><button onClick={() => {}}>Centered</button></view>');
    await screen.getByRole('button', { name: 'Centered' }).waitFor();
    const centered = await screen.evaluate(element => {
        const outer = element.getBoundingClientRect();
        const inner = element.querySelector('code').getBoundingClientRect();
        const button = getComputedStyle(element.querySelector('button'));
        const view = getComputedStyle(element);
        return { x: inner.x + inner.width / 2 - outer.x - outer.width / 2,
            y: inner.y + inner.height / 2 - outer.y - outer.height / 2,
            inverse: button.color === view.backgroundColor && button.backgroundColor === view.color,
            radius: parseFloat(button.borderRadius) };
    });
    assert.ok(Math.abs(centered.x) < 1 && Math.abs(centered.y) < 1, 'center aligns on both axes');
    assert.equal(centered.inverse, true);
    assert.ok(centered.radius > 0 && centered.radius < 8);
    await run('<view small center><button onClick={() => {}}>Small</button></view>');
    await screen.getByRole('button', { name: 'Small', exact: true }).waitFor();
    const small = await screen.evaluate(element => {
        const outer = element.getBoundingClientRect();
        const inner = element.querySelector('code').getBoundingClientRect();
        return { height: element.clientHeight, width: outer.width,
            x: inner.x + inner.width / 2 - outer.x - outer.width / 2,
            y: inner.y + inner.height / 2 - outer.y - outer.height / 2 };
    });
    assert.ok(Math.abs(small.height - 3 * layout.line) <= 1, 'small is three lines high');
    assert.ok(Math.abs(small.width - layout.width * 2 / 3) <= 1, 'small is two-thirds of a normal view width');
    assert.ok(Math.abs(small.x) < 1 && Math.abs(small.y) < 1, 'small combines with center');
    await run('<view center={false}>Left</view>');
    await page.waitForFunction(() => document.querySelector('#program-screen').textContent === 'Left');
    assert.equal(await screen.evaluate(element => element.classList.contains('is-centered')), false);
    const restored = await screen.evaluate(element => ({ height: element.clientHeight, width: element.getBoundingClientRect().width, small: element.classList.contains('is-small') }));
    assert.equal(restored.small, false);
    assert.equal(restored.height, layout.height);
    assert.ok(Math.abs(restored.width - layout.width) <= 1, 'A normal frame restores full width');

    await run('<view>\n\n\n          Middle\n\n\n</view>');
    await page.waitForFunction(() => document.querySelector('#program-screen').textContent.includes('Middle'));
    assert.equal(await screen.textContent(), '\n\n\n          Middle\n\n\n');

    await run('let clicks=0; const draw = () => <view>{clicks} <button onClick={() => { clicks++; draw(); }}>Next</button></view>; draw();');
    await screen.getByRole('button', { name: 'Next' }).click();
    await page.waitForFunction(() => document.querySelector('#program-screen').textContent === '1 Next');
    await run('let entered=""; <view><input onInput={value => { entered=value; }} placeholder="Name" /><button onClick={() => <view>Hello, {entered}!</view>}>Done</button></view>;');
    const field = screen.getByRole('textbox', { name: 'Name' });
    await field.fill('<img src=x>');
    await page.waitForTimeout(600);
    assert.equal(await field.inputValue(), '<img src=x>');
    assert.equal(await field.evaluate(element => element === document.activeElement), true);
    await screen.getByRole('button', { name: 'Done' }).click();
    await page.waitForFunction(() => document.querySelector('#program-screen').textContent === 'Hello, <img src=x>!');
    assert.equal(await screen.locator('img').count(), 0);
    assert.equal(await screen.locator('input').count(), 0);

    await run('<view><input onInput={value => { entered=value; }} /></view>;');
    await screen.locator('input').fill('discard me');
    await page.waitForTimeout(100);
    await run('<view><input onInput={value => { entered=value; }} /></view>;');
    await page.waitForFunction(() => document.querySelector('#program-screen input')?.value === '');

    await run('let keyCount=0; <button onPress={key => { if(key === "ArrowRight") { keyCount++; <view>{keyCount}</view>; } }} />; <view>Keys</view>;');
    await page.waitForFunction(() => document.querySelector('#program-screen').textContent === 'Keys');
    await screen.click();
    await page.keyboard.press('ArrowRight');
    await page.waitForFunction(() => document.querySelector('#program-screen').textContent === '1');
    await page.keyboard.press('ArrowRight');
    await page.waitForFunction(() => document.querySelector('#program-screen').textContent === '2');
    await editor.focus();
    await editor.fill('hello');
    await editor.press('ArrowRight');
    await page.waitForTimeout(350);
    assert.equal(await screen.textContent(), '2', 'Editing must not trigger program key listeners');
    await editor.fill('');
    await page.keyboard.press('Control+l');
    assert.equal(await screen.isVisible(), false);
    await run('<view>Again</view>');
    await page.waitForFunction(() => document.querySelector('#program-screen').textContent === 'Again');
    await screen.focus();
    await page.keyboard.press('ArrowRight');
    await page.waitForFunction(() => document.querySelector('#program-screen').textContent === '3');

    await run('for(let n=0;n<20;n++) <view>{n}</view>;');
    await page.keyboard.press('Control+l');
    await page.waitForTimeout(750);
    assert.equal(await screen.isVisible(), false, 'Clear cancels queued frames');
    await run('<view><button onClick={() => { throw Error("callback failure"); }}>Fail</button></view>');
    await screen.getByRole('button', { name: 'Fail' }).click();
    await page.waitForFunction(() => [...document.querySelectorAll('.entry-error')].some(element => element.textContent.includes('callback failure')));
    assert.equal(await screen.isVisible(), false);
    assert.match(await run('keyCount'), /Cannot find name/);

    await run(String.raw`<view>{"\n\n  Your name: "}<input onInput={value => {}} placeholder="Name" />{"\n\n  "}<button onClick={() => <view>Welcome!</view>}>Continue</button></view>`);
    await screen.getByRole('button', { name: 'Continue' }).waitFor();
    await screen.scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'test-results/terminal-views-mobile.png' });
    console.log('TSX browser checks passed: FIFO playback, inline scrolling, optional centering, compact and normal dimensions, inverse buttons, whitespace, clicks, input lifecycle, literal text, persistent keys, editor isolation, clear and callback reset.');
}
