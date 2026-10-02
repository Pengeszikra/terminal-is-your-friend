// Coded by OpenAI Codex. UI and submitted snippets both use the pipeline TypeScript fork.
import { highlight } from "./highlight.js";
import type { Evaluation, Output } from "./sandbox.js";

const input = document.querySelector<HTMLTextAreaElement>("#input")!;
const output = document.querySelector<HTMLElement>("#output")!;
const terminal = document.querySelector<HTMLElement>("#terminal")!;
const code = document.querySelector<HTMLElement>("#highlight-code")!;
const editor = document.querySelector<HTMLElement>(".editor")!;
const status = document.querySelector<HTMLElement>("#status")!;
const resetButton = document.querySelector<HTMLButtonElement>("#reset")!;
let worker: Worker;
let ready = false;
let busy = false;
let accepted: string[] = [];
let history: string[] = [];
let historyIndex = 0;
let draft = "";
let validDraft = "";
let checkTimer = 0;
let watchdog = 0;
let requestId = 0;
let checkController: AbortController | undefined;
let pending: { id: number; source: string } | undefined;

// Coded by OpenAI Codex.
const scroll = () => { terminal.scrollTop = terminal.scrollHeight; };
const label = (text: string) => { status.textContent = text; };
const append = (kind: string, text: string, marker = "") => {
    const row = document.createElement("div");
    row.className = `entry entry-${kind}`;
    const prefix = document.createElement("span");
    prefix.className = "entry-marker";
    prefix.textContent = marker;
    prefix.setAttribute("aria-hidden", "true");
    const content = document.createElement("pre");
    if (kind === "command") highlight(text, content);
    else content.textContent = text;
    row.append(prefix, content);
    output.append(row);
    while (output.children.length > 300) output.firstElementChild?.remove();
    scroll();
};

// Coded by OpenAI Codex.
const welcome = () => {
    append("note", "TypeScript, with room to think.");
    append("note", "Try: 21 |> ((n: number) => n * 2)");
};

// Coded by OpenAI Codex.
const setBusy = (value: boolean) => {
    busy = value;
    input.readOnly = value;
    resetButton.disabled = value;
};

// Coded by OpenAI Codex.
const finish = () => {
    window.clearTimeout(watchdog);
    pending = undefined;
    setBusy(false);
    label("TS |> · sandbox ready");
    input.focus();
    scroll();
};

// Coded by OpenAI Codex. A watchdog can terminate the entire worker even if the guest misbehaves.
const startWorker = () => {
    ready = false;
    input.disabled = true;
    worker?.terminate();
    worker = new Worker(new URL("./worker.js", import.meta.url), { type: "module" });
    worker.onmessage = event => {
        if (event.data.type === "ready") {
            ready = true;
            input.disabled = false;
            finish();
        } else if (event.data.type === "output") {
            const message = event.data.output as Output;
            if (message.kind === "clear") output.replaceChildren();
            else append(message.kind, message.text);
        } else if (event.data.type === "result" && pending && pending.id === event.data.id) {
            const result = event.data.result as Evaluation;
            if (result.ok) {
                accepted.push(pending.source);
                append("result", result.value ?? "undefined", "←");
            } else {
                append("error", result.error ?? "Execution failed.", "!");
                if (result.reset) {
                    accepted = [];
                    append("note", "Runtime reset after the error. Variables were cleared; command history is still available.");
                }
            }
            finish();
        } else if (event.data.type === "fatal") {
            window.clearTimeout(watchdog);
            accepted = [];
            pending = undefined;
            ready = false;
            setBusy(false);
            input.disabled = true;
            append("error", "Sandbox could not start. " + event.data.error, "!");
            label("Sandbox unavailable");
        }
    };
    worker.onerror = () => {
        window.clearTimeout(watchdog);
        accepted = [];
        ready = false;
        setBusy(false);
        input.disabled = true;
        append("error", "Sandbox worker stopped. Use Reset session to restart.", "!");
        label("Sandbox stopped");
    };
};

// Coded by OpenAI Codex. Real pipeline use in the application's own TypeScript source.
const normalize = (value: string) => value.replace(/\r\n?/g, "\n");
const withinLimits = (value: string) => value.split("\n").length <= 100 && new TextEncoder().encode(value).length <= 8192;
const redraw = () => {
    input.value = input.value |> normalize;
    highlight(input.value, code);
};

// Coded by OpenAI Codex. Diagnostics affect the palette silently until submission.
const scheduleCheck = () => {
    window.clearTimeout(checkTimer);
    checkController?.abort();
    editor.classList.remove("has-errors");
    if (!input.value.trim() || busy) return;
    const source = input.value;
    checkTimer = window.setTimeout(async () => {
        const controller = new AbortController();
        checkController = controller;
        try {
            const response = await fetch("/api/check", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ source, history: accepted }), signal: controller.signal,
            });
            if (!response.ok) return;
            const result = await response.json();
            if (!controller.signal.aborted && input.value === source && !busy) editor.classList.toggle("has-errors", !result.ok);
        } catch { /* Coded by OpenAI Codex: an interrupted background check is not a terminal error. */ }
    }, 700);
};

// Coded by OpenAI Codex.
const submit = async () => {
    if (busy || !ready || !input.value.trim()) return;
    const source = input.value |> normalize;
    if (!withinLimits(source)) { append("error", "Limit: 100 lines and 8 KB per submission.", "!"); return; }
    window.clearTimeout(checkTimer);
    checkController?.abort();
    history.push(source);
    if (history.length > 200) history.shift();
    historyIndex = history.length;
    draft = "";
    validDraft = "";
    input.value = "";
    redraw();
    editor.classList.remove("has-errors");
    append("command", source, "❯");
    setBusy(true);
    label("Checking TypeScript…");
    try {
        const response = await fetch("/api/compile", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ source, history: accepted }), signal: AbortSignal.timeout(15_000),
        });
        const compiled = await response.json();
        if (!response.ok || !compiled.ok) { append("error", compiled.error || "Compilation failed.", "!"); finish(); return; }
        pending = { id: ++requestId, source };
        label("Running…");
        watchdog = window.setTimeout(() => {
            append("error", "Sandbox stopped after 3 seconds. Variables cleared; history preserved.", "!");
            accepted = [];
            pending = undefined;
            startWorker();
        }, 3_000);
        worker.postMessage({ type: "run", id: pending.id, javascript: compiled.javascript });
    } catch (error) {
        append("error", error instanceof Error ? error.message : "Compiler connection failed.", "!");
        finish();
    }
};

// Coded by OpenAI Codex.
input.addEventListener("input", () => {
    if (!withinLimits(input.value)) {
        input.value = validDraft;
        label("Input limit: 100 lines / 8 KB");
    } else validDraft = input.value;
    redraw();
    scheduleCheck();
});

// Coded by OpenAI Codex. Reject oversized pastes whole, without silently truncating the program.
input.addEventListener("paste", event => {
    const paste = event.clipboardData?.getData("text/plain") ?? "";
    const candidate = input.value.slice(0, input.selectionStart) + normalize(paste) + input.value.slice(input.selectionEnd);
    if (!withinLimits(candidate)) { event.preventDefault(); label("Paste rejected: limit is 100 lines / 8 KB"); }
});

// Coded by OpenAI Codex. Arrow history only at the first/last line; normal multiline navigation elsewhere.
input.addEventListener("keydown", event => {
    if (event.isComposing || busy) return;
    if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void submit(); return; }
    if (event.key === "Tab") {
        event.preventDefault();
        input.setRangeText("  ", input.selectionStart, input.selectionEnd, "end");
        input.dispatchEvent(new Event("input"));
        return;
    }
    const firstLine = !input.value.slice(0, input.selectionStart).includes("\n");
    const lastLine = !input.value.slice(input.selectionEnd).includes("\n");
    if (input.selectionStart !== input.selectionEnd) return;
    if ((event.key === "ArrowUp" && (firstLine || event.altKey)) || (event.key === "ArrowDown" && (lastLine || event.altKey))) {
        event.preventDefault();
        if (historyIndex === history.length) draft = input.value;
        historyIndex = Math.max(0, Math.min(history.length, historyIndex + (event.key === "ArrowUp" ? -1 : 1)));
        input.value = historyIndex === history.length ? draft : history[historyIndex] ?? "";
        validDraft = input.value;
        redraw();
        input.setSelectionRange(input.value.length, input.value.length);
        scheduleCheck();
    }
});

// Coded by OpenAI Codex.
document.querySelector("#clear")!.addEventListener("click", () => { output.replaceChildren(); input.focus(); });
resetButton.addEventListener("click", () => {
    window.clearTimeout(checkTimer);
    checkController?.abort();
    accepted = [];
    editor.classList.remove("has-errors");
    append("note", "Session reset. Variables cleared; history preserved.");
    startWorker();
});
welcome();
redraw();
startWorker();
