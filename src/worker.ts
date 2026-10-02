// Coded by OpenAI Codex. Only this trusted worker can access browser APIs; guest code runs in QuickJS.
import { createSandbox } from "./sandbox.js";

const channel = globalThis as unknown as {
    postMessage: (message: unknown) => void;
    onmessage: ((event: MessageEvent) => void) | null;
};

// Coded by OpenAI Codex.
createSandbox(output => channel.postMessage({ type: "output", output })).then(sandbox => {
    channel.onmessage = event => {
        const { type, javascript, id } = event.data;
        if (type === "run" && typeof javascript === "string") channel.postMessage({ type: "result", id, result: sandbox.evaluate(javascript) });
        else if (type === "reset") { sandbox.reset(); channel.postMessage({ type: "ready" }); }
    };
    channel.postMessage({ type: "ready" });
}).catch(error => channel.postMessage({ type: "fatal", error: String(error) }));
