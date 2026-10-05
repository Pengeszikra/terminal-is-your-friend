// Coded by OpenAI Codex. UI and submitted snippets both use the pipeline TypeScript fork.
import { createViewScreen } from "./view.js";
import type { ViewFrame, ViewEvent } from "./view-runtime.js";
import { highlight } from "./highlight.js";
import { typewrite } from "./typewriter.js";
import { instructorQuestion, welcomeMessage, idleDelay } from "./instructor.js";
import { InstructorSession } from "./instructor-memory.js";
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
let instructorSession = new InstructorSession();
let executionOutput = "";
let idleTimer = 0;
let learnerTask = "";
let instructorLanguage = "en";
let idleTurn = 0;
let autoPaused = false;
let instructorRequest: { controller: AbortController; kind: string } | undefined;

// Keep callback execution sequential, bounded and separate from terminal return values.
const sendNextEvent = () => {
    if (eventPending !== undefined || busy || !ready || !eventQueue.length) return;
    eventPending = ++requestId;
    input.readOnly = true;
    const event = eventQueue.shift()!;
    executionOutput = "";
    eventWatchdog = window.setTimeout(() => {
        accepted = [];
        append("error", "Event handler stopped after 3 seconds. Variables cleared.", "!");
        startWorker();
        explainError(lastProgramSource, "Event handler exceeded the execution limit.", "runtime", "event");
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
const remember = (kind: string, text: string, example = "") => {
    instructorSession.remember(kind, text, example);
};
const append = (kind: string, text: string, marker = "", example = "", record = true) => {
    if (record) remember(kind, text, example);
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
    return { row, content, body };
};

// Coded by OpenAI Codex.
const cancelInstructor = () => {
    instructorRequest?.controller.abort();
    instructorRequest = undefined;
};

const presentInstructor = async (answer: string, example: string, controller: AbortController) => {
    const { row, content, body } = append("answer", "", "AI", "", false);
    row.setAttribute("aria-busy", "true");
    const sample = document.createElement("pre");
    sample.className = "instructor-code";
    sample.hidden = true;
    const sampleCode = document.createElement("code");
    sample.append(sampleCode);
    body.append(sample);
    try {
        await typewrite(content, sampleCode, answer, example, controller.signal, () => {
            if (terminal.scrollHeight - terminal.scrollTop - terminal.clientHeight < 80) scroll();
        });
        remember("answer", answer, example);
    } catch (error) {
        row.remove();
        throw error;
    } finally { row.removeAttribute("aria-busy"); }
};

const canInitiate = () => ready && !busy && eventPending === undefined && !instructorRequest &&
    !learnerTask && !autoPaused && !input.value.trim() && !document.hidden &&
    !screenElement.contains(document.activeElement);

const scheduleConversation = () => {
    window.clearTimeout(idleTimer);
    if (!canInitiate()) return;
    idleTimer = window.setTimeout(() => {
        if (canInitiate()) void askInstructor({ kind: "idle" });
    }, idleDelay());
};

type InstructorDetails = { kind: "question" | "idle" | "error" | "review"; question?: string; source?: string; error?: string; phase?: "compile" | "runtime"; result?: string };
const askInstructor = async (details: InstructorDetails, context = instructorSession.context.slice()) => {
    cancelInstructor();
    window.clearTimeout(idleTimer);
    const controller = new AbortController();
    instructorRequest = { controller, kind: details.kind };
    try {
        const response = await fetch("/api/instructor", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...details, context, memory: instructorSession.memory, codeState: instructorSession.codeState,
                learnerTask, language: instructorLanguage, ...(details.kind === "idle" ? { idleTurn } : {}) }),
            signal: AbortSignal.any([controller.signal, AbortSignal.timeout(25_000)]),
        });
        const result = await response.json();
        if (controller.signal.aborted) return;
        if (!response.ok || !result.ok || typeof result.answer !== "string") {
            autoPaused = true;
            append("error", result.error || "Instructor request failed.", "!");
        } else {
            await presentInstructor(result.answer, typeof result.code === "string" ? result.code : "", controller);
            if (controller.signal.aborted) return;
            instructorSession.updateMemory(result.memory);
            // The model explicitly retains or clears a concrete task after questions/reviews.
            if (typeof result.learnerTask === "string") learnerTask = result.learnerTask.slice(0, 400);
            if (typeof result.language === "string") instructorLanguage = result.language;
            if (details.kind === "idle") idleTurn++;
        }
    } catch {
        if (!controller.signal.aborted) {
            autoPaused = true;
            append("error", "Could not reach the instructor. Please try again.", "!");
        }
    } finally {
        if (instructorRequest?.controller === controller) instructorRequest = undefined;
        scheduleConversation();
    }
};

const greet = async () => {
    const controller = new AbortController();
    instructorRequest = { controller, kind: "welcome" };
    try { await presentInstructor(welcomeMessage, "", controller); }
    catch { /* A user submission or Clear can interrupt the greeting. */ }
    finally {
        if (instructorRequest?.controller === controller) instructorRequest = undefined;
        scheduleConversation();
    }
};

const activity = () => {
    if (instructorRequest?.kind === "idle") cancelInstructor();
    scheduleConversation();
};

const explainError = (source: string, error: string, phase: "compile" | "runtime", trigger: "submission" | "event" = "submission") => {
    instructorSession.record({ source: trigger === "event" ? "" : source, error, phase, status: "error", trigger,
        output: executionOutput }, phase === "runtime" ? "cleared" : instructorSession.codeState.variables);
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
    scheduleConversation();
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
        } else if (event.data.type === "view-start" && pending?.id === event.data.id) {
            // Worker ordering ensures old frames arrive before we freeze the previous screen.
            screen.archive();
            screen.clear();
            eventQueue = [];
        } else if (event.data.type === "frame") {
            const followOutput = terminal.scrollHeight - terminal.scrollTop - terminal.clientHeight < 40;
            if (!screenElement.isConnected) output.append(screenElement);
            screen.render(event.data.frame as ViewFrame);
            if (followOutput) scroll();
            activity();
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
                explainError(lastProgramSource, result.error ?? "Event handler failed.", "runtime", "event");
            } else instructorSession.record({ source: "", status: "success", phase: "runtime", trigger: "event", output: executionOutput }, "preserved");
            sendNextEvent();
            scheduleConversation();
        } else if (event.data.type === "output") {
            const message = event.data.output as Output;
            if (message.kind === "clear") { output.replaceChildren(); clearViews(); }
            else {
                executionOutput += (executionOutput ? "\n" : "") + `${message.kind}: ${message.text}`;
                if (executionOutput.length > 1000) executionOutput = "[truncated]\n" + executionOutput.slice(-988);
                append(message.kind, message.text);
            }
        } else if (event.data.type === "result" && pending && pending.id === event.data.id) {
            const result = event.data.result as Evaluation;
            const source = pending.source;
            if (result.ok) {
                instructorSession.record({ source, status: "success", phase: "runtime", trigger: "submission",
                    result: result.value ?? "undefined", output: executionOutput }, "preserved");
                accepted.push(pending.source);
                append("result", result.value ?? "undefined", "←");
                // Reserve the new screen's position before asynchronous instructor replies.
                output.append(screenElement);
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
            else if (learnerTask) void askInstructor({ kind: "review", source, result: result.value ?? "undefined" });
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
    const context = instructorSession.context.slice();
    autoPaused = false;
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
    executionOutput = "";
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
            else instructorSession.record({ source, error, status: "not-run", phase: "compile", trigger: "submission" }, instructorSession.codeState.variables);
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
        const message = error instanceof Error ? error.message : "Compiler connection failed.";
        instructorSession.record({ source, error: message, status: "not-run", phase: "compile", trigger: "submission" }, instructorSession.codeState.variables);
        append("error", message, "!");
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
    output.replaceChildren();
    clearViews();
    input.focus();
    scheduleConversation();
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
            target !== input && target.tagName !== "INPUT" && target.tagName !== "TEXTAREA" && !target.isContentEditable && !target.closest(".view-snapshot")) {
            screen.key(event.key);
            if (screenElement.contains(target) && ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(event.key)) event.preventDefault();
        }
    }
}, { capture: true });
document.addEventListener("pointerdown", activity);
document.addEventListener("input", activity);
document.addEventListener("focusin", activity);
terminal.addEventListener("wheel", activity, { passive: true });
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
    instructorSession = new InstructorSession();
    lastProgramSource = "";
    executionOutput = "";
    learnerTask = "";
    instructorLanguage = "en";
    idleTurn = 0;
    autoPaused = false;
    editor.classList.remove("has-errors");
    append("note", "Session reset. Variables and instructor context cleared; command history preserved.");
    startWorker();
});
redraw();
startWorker();
void greet();
