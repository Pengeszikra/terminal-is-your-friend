// Coded by OpenAI Codex. Only trusted code accesses browser APIs; callbacks stay in QuickJS.
import { createSandbox } from "./sandbox.js";

const channel = globalThis as unknown as {
    postMessage: (message: unknown) => void;
    onmessage: ((event: MessageEvent) => void) | null;
};

createSandbox(output => channel.postMessage({ type: "output", output })).then(sandbox => {
    channel.onmessage = event => {
        const { type, javascript, id } = event.data;
        if (type === "run" && typeof javascript === "string") channel.postMessage({ type: "result", id, result: sandbox.evaluate(javascript) });
        else if (type === "event") channel.postMessage({ type: "event-result", id, result: sandbox.dispatch(event.data.event) });
        else if (type === "clear-views") sandbox.clearViews();
        else if (type === "reset") { sandbox.reset(); channel.postMessage({ type: "ready" }); }
    };
    setInterval(() => {
        try {
            const frame = sandbox.nextFrame();
            if (frame) channel.postMessage({ type: "frame", frame });
        } catch (error) {
            sandbox.reset();
            channel.postMessage({ type: "event-result", result: { ok: false, reset: true, error: String(error) } });
        }
    }, 250);
    channel.postMessage({ type: "ready" });
}).catch(error => channel.postMessage({ type: "fatal", error: String(error) }));
