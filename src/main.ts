// Coded by OpenAI Codex. UI and submitted snippets both use the pipeline TypeScript fork.
import { createViewScreen } from "./view.js";
import type { ViewFrame, ViewEvent } from "./view-runtime.js";
import { highlight } from "./highlight.js";
import { instructorQuestion } from "./instructor.js";
import type { Evaluation, Output } from "./sandbox.js";

const input = document.querySelector<HTMLTextAreaElement>("#input")!;
const output = document.querySelector<HTMLElement>("#output")!;
const terminal = document.querySelector<HTMLElement>("#terminal")!;
const code = document.querySelector<HTMLElement>("#highlight-code")!;
const editor = document.querySelector<HTMLElement>(".editor")!;
const status = document.querySelector<HTMLElement>("#status")!;
const resetButton = document.querySelector<HTMLButtonElement>("#reset")!;
const screenElement = document.querySelector<HTMLElement>("#program-screen")!;
let eventWatchdog = 0;
let eventPending: number | undefined;
let eventQueue: ViewEvent[] = [];
let lastProgramSource = "";
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
let instructorContext: { kind: string; text: string }[] = [];
let idleTimer = 0;
let introduced = false;
let instructorRequest: { controller: AbortController; kind: string } | undefined;

// Keep callback execution sequential, bounded and separate from terminal return values.
const sendNextEvent = () => {
    if (eventPending !== undefined || busy || !ready || !eventQueue.length) return;
    eventPending = ++requestId;
    input.readOnly = true;
    const event = eventQueue.shift()!;
    eventWatchdog = window.setTimeout(() => {
        accepted = [];
        append("error", "Event handler stopped after 3 seconds. Variables cleared.", "!");
        startWorker();
        explainError(lastProgramSource, "Event handler exceeded the execution limit.", "runtime");
    }, 3000);
    worker.postMessage({ type: "event", id: eventPending, event });
};
const screen = createViewScreen(screenElement, event => {
    if (!ready || busy) return;
    const last = eventQueue.at(-1);
    if (event.kind === "input" && last?.kind === "input" && last.id === event.id) eventQueue[eventQueue.length - 1] = event;
    else if (eventQueue.length < 100) eventQueue.push(event);
    sendNextEvent();
});
const clearViews = () => {
    screen.clear();
    output.append(screenElement);
    eventQueue = [];
    if (ready) worker.postMessage({ type: "clear-views" });
};

// Coded by OpenAI Codex.
const scroll = () => { terminal.scrollTop = terminal.scrollHeight; };
const label = (text: string) => { status.textContent = text; };
const append = (kind: string, text: string, marker = "", example = "") => {
    instructorContext.push({ kind, text: (text + (example ? "\n" + example : "")).slice(0, 1200) });
    if (instructorContext.length > 12) instructorContext.shift();
    const row = document.createElement("div");
    row.className = `entry entry-${kind}`;
    const prefix = document.createElement("span");
    prefix.className = "entry-marker";
    prefix.textContent = marker;
    prefix.setAttribute("aria-hidden", "true");
    const content = document.createElement("pre");
    if (kind === "command") highlight(text, content);
    else content.textContent = text;
    const body = document.createElement("div");
    body.className = "entry-body";
    body.append(content);
    if (example) {
        const sample = document.createElement("pre");
        sample.className = "instructor-code";
        const sampleCode = document.createElement("code");
        highlight(example, sampleCode);
        sample.append(sampleCode);
        body.append(sample);
    }
    row.append(prefix, body);
    output.append(row);
    while (output.children.length > 300) {
        const oldestEntry = Array.from(output.children).find(child => child !== screenElement);
        oldestEntry?.remove();
    }
    scroll();
};

// Coded by OpenAI Codex.
const cancelInstructor = () => {
    instructorRequest?.controller.abort();
    instructorRequest = undefined;
};

const askInstructor = async (details: { kind: "question" | "welcome" | "error"; question?: string; source?: string; error?: string; phase?: "compile" | "runtime" }, context = instructorContext.slice()) => {
    cancelInstructor();
    window.clearTimeout(idleTimer);
    introduced = true;
    const controller = new AbortController();
    instructorRequest = { controller, kind: details.kind };
    try {
        const response = await fetch("/api/instructor", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...details, context }), signal: AbortSignal.any([controller.signal, AbortSignal.timeout(25_000)]),
        });
        const result = await response.json();
        if (controller.signal.aborted) return;
        if (!response.ok || !result.ok || typeof result.answer !== "string") append("error", result.error || "Instructor request failed.", "!");
        else append("answer", result.answer, "AI", typeof result.code === "string" ? result.code : "");
    } catch {
        if (!controller.signal.aborted) append("error", "Could not reach the instructor. Please try again.", "!");
    } finally {
        if (instructorRequest?.controller === controller) instructorRequest = undefined;
    }
};

const scheduleIntroduction = () => {
    window.clearTimeout(idleTimer);
    if (introduced || !ready || busy || input.value.trim() || document.hidden) return;
    idleTimer = window.setTimeout(() => {
        if (!introduced && ready && !busy && !input.value.trim() && !document.hidden) void askInstructor({ kind: "welcome" });
    }, 10_000);
};

const activity = () => {
    if (instructorRequest?.kind === "welcome") {
        cancelInstructor();
        introduced = false;
    }
    scheduleIntroduction();
};

const explainError = (source: string, error: string, phase: "compile" | "runtime") => {
    void askInstructor({ kind: "error", source, error, phase });
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
    label("TSX |> · sandbox ready");
    input.focus();
    scroll();
    scheduleIntroduction();
};

// Coded by OpenAI Codex. A watchdog can terminate the entire worker even if the guest misbehaves.
const startWorker = () => {
    ready = false;
    window.clearTimeout(eventWatchdog);
    eventPending = undefined;
    eventQueue = [];
    screen.clear();
    input.disabled = true;
    worker?.terminate();
    worker = new Worker(new URL("./worker.js", import.meta.url), { type: "module" });
    worker.onmessage = event => {
        if (event.data.type === "ready") {
            ready = true;
            input.disabled = false;
            finish();
        } else if (event.data.type === "frame") {
            const followOutput = terminal.scrollHeight - terminal.scrollTop - terminal.clientHeight < 40;
            if (screenElement.hidden || !screenElement.isConnected) output.append(screenElement);
            screen.render(event.data.frame as ViewFrame);
            if (followOutput) scroll();
        } else if (event.data.type === "event-result") {
            window.clearTimeout(eventWatchdog);
            eventPending = undefined;
            input.readOnly = busy;
            const result = event.data.result as Evaluation;
            if (!result.ok) {
                accepted = [];
                clearViews();
                append("error", result.error ?? "Event handler failed.", "!");
                append("note", "Runtime reset after the error. Variables and event listeners were cleared.");
                explainError(lastProgramSource, result.error ?? "Event handler failed.", "runtime");
            }
            sendNextEvent();
        } else if (event.data.type === "output") {
            const message = event.data.output as Output;
            if (message.kind === "clear") { output.replaceChildren(); clearViews(); }
            else append(message.kind, message.text);
        } else if (event.data.type === "result" && pending && pending.id === event.data.id) {
            const result = event.data.result as Evaluation;
            const source = pending.source;
            if (result.ok) {
                accepted.push(pending.source);
                append("result", result.value ?? "undefined", "←");
            } else {
                append("error", result.error ?? "Execution failed.", "!");
                if (result.reset) {
                    accepted = [];
                    clearViews();
                    append("note", "Runtime reset after the error. Variables were cleared; command history is still available.");
                }
            }
            finish();
            if (!result.ok) explainError(source, result.error ?? "Execution failed.", "runtime");
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
    if (!input.value.trim() || busy || instructorQuestion(input.value) !== null) return;
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
    if (busy || eventPending !== undefined || !ready || !input.value.trim()) return;
    const source = input.value |> normalize;
    if (!withinLimits(source)) { append("error", "Limit: 100 lines and 8 KB per submission.", "!"); return; }
    const question = instructorQuestion(source);
    if (question !== null && (!question || question.length > 4000)) {
        append("error", "Enter a question of up to 4,000 characters after //.", "!");
        return;
    }
    const context = instructorContext.slice();
    cancelInstructor();
    window.clearTimeout(idleTimer);
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
    append(question === null ? "command" : "question", source, "❯");
    setBusy(true);
    if (question !== null) {
        label("Asking instructor…");
        try {
            await askInstructor({ kind: "question", question }, context);
        } finally { finish(); }
        return;
    }
    label("Checking TypeScript…");
    try {
        const response = await fetch("/api/compile", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ source, history: accepted }), signal: AbortSignal.timeout(15_000),
        });
        const compiled = await response.json();
        if (!response.ok || !compiled.ok) {
            const error = compiled.error || "Compilation failed.";
            append("error", error, "!");
            finish();
            if (response.ok) explainError(source, error, "compile");
            return;
        }
        lastProgramSource = source;
        pending = { id: ++requestId, source };
        label("Running…");
        watchdog = window.setTimeout(() => {
            const error = "Sandbox stopped after 3 seconds. Variables cleared; history preserved.";
            append("error", error, "!");
            accepted = [];
            pending = undefined;
            startWorker();
            explainError(source, error, "runtime");
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
    activity();
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
const clearScreen = () => {
    cancelInstructor();
    window.clearTimeout(idleTimer);
    introduced = true;
    output.replaceChildren();
    clearViews();
    input.focus();
};
document.querySelector("#clear")!.addEventListener("click", clearScreen);
document.addEventListener("keydown", event => {
    if (event.ctrlKey && event.key.toLowerCase() === "l") {
        event.preventDefault();
        clearScreen();
    } else {
        activity();
        const target = event.target as HTMLElement;
        if (!event.isComposing && !event.ctrlKey && !event.metaKey && !event.altKey &&
            target !== input && target.tagName !== "INPUT" && target.tagName !== "TEXTAREA" && !target.isContentEditable) {
            screen.key(event.key);
            if (screenElement.contains(target) && ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(event.key)) event.preventDefault();
        }
    }
}, { capture: true });
document.addEventListener("pointerdown", activity);
terminal.addEventListener("click", event => {
    const target = event.target as HTMLElement;
    if (!target.closest("textarea, input, button, a, .editor")) {
        const focusTarget = screenElement.contains(target) ? screenElement : terminal;
        focusTarget.focus({ preventScroll: true });
    }
});
document.addEventListener("visibilitychange", activity);
resetButton.addEventListener("click", () => {
    cancelInstructor();
    window.clearTimeout(idleTimer);
    window.clearTimeout(checkTimer);
    checkController?.abort();
    accepted = [];
    instructorContext = [];
    editor.classList.remove("has-errors");
    append("note", "Session reset. Variables and instructor context cleared; command history preserved.");
    startWorker();
});
redraw();
startWorker();
