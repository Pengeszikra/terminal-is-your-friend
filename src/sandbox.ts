// Coded by OpenAI Codex. QuickJS is a separate WASM VM; no browser/Node objects cross this boundary.
import { viewRuntimeSource, type ViewFrame, type ViewEvent } from "./view-runtime.js";
import { getQuickJS, type QuickJSContext, type QuickJSHandle } from "quickjs-emscripten";

export type Output = { kind: "log" | "info" | "warn" | "error" | "clear"; text: string };
export type Evaluation = { ok: boolean; value?: string; error?: string; reset?: boolean };
const timeLimit = 2_000;
const outputLimit = 100;

// Coded by OpenAI Codex. This formatter runs INSIDE the guest VM, with the same execution limits.
const formatterSource = `
// Coded by OpenAI Codex.
(value => {
    const seen = new Set();
    const visit = (item, depth) => {
        if (typeof item === "string") return JSON.stringify(item.slice(0, 2000)) + (item.length > 2000 ? "…" : "");
        if (typeof item === "bigint") return String(item) + "n";
        if (typeof item === "function") return "[Function]";
        if (item === null || typeof item !== "object") return String(item);
        if (seen.has(item)) return "[Circular]";
        if (depth > 3) return "[…]";
        seen.add(item);
        const array = Array.isArray(item);
        const parts = [];
        let count = 0;
        for (const key in item) {
            if (!Object.prototype.hasOwnProperty.call(item, key)) continue;
            if (count++ === 20) { parts.push("…"); break; }
            const descriptor = Object.getOwnPropertyDescriptor(item, key);
            const value = descriptor && "value" in descriptor ? visit(descriptor.value, depth + 1) : "[Getter]";
            parts.push((array ? "" : key.slice(0, 80) + ": ") + value);
        }
        return (array ? "[" : "{ ") + parts.join(", ") + (array ? "]" : " }");
    };
    return visit(value, 0).slice(0, 4000);
})`;

// Coded by OpenAI Codex.
export async function createSandbox(onOutput: (output: Output) => void) {
    const engine = await getQuickJS();
    let vm: QuickJSContext;
    let formatter: QuickJSHandle;
    let views: QuickJSHandle;
    let returnSignal: QuickJSHandle;
    let deadline = 0;
    let count = 0;
    let outputBytes = 0;

    // Coded by OpenAI Codex.
    const format = (handle: QuickJSHandle): string => {
        const result = vm.callFunction(formatter, vm.undefined, handle);
        if (result.error) { result.error.dispose(); return "[Unprintable value]"; }
        const text = vm.getString(result.value).slice(0, 4000);
        result.value.dispose();
        return text;
    };

    // Coded by OpenAI Codex.
    const initialize = () => {
        vm = engine.newContext();
        vm.runtime.setMemoryLimit(32 * 1024 * 1024);
        vm.runtime.setMaxStackSize(512 * 1024);
        vm.runtime.setInterruptHandler(() => Date.now() > deadline);
        deadline = Date.now() + timeLimit;
        formatter = vm.unwrapResult(vm.evalCode(formatterSource));
        views = vm.unwrapResult(vm.evalCode(viewRuntimeSource));
        returnSignal = vm.getProp(views, "returnSignal");
        const consoleObject = vm.newObject();
        for (const kind of ["log", "info", "warn", "error", "clear"] as const) {
            const fn = vm.newFunction(kind, (...args) => {
                if (count++ >= outputLimit || outputBytes >= 32_000) {
                    if (count === outputLimit + 1) onOutput({ kind: "warn", text: "Console output truncated." });
                    return vm.undefined;
                }
                const text = args.slice(0, 20).map(format).join(" ").slice(0, 4000);
                outputBytes += text.length;
                onOutput({ kind, text });
                return vm.undefined;
            });
            vm.setProp(consoleObject, kind, fn);
            fn.dispose();
        }
        vm.setProp(vm.global, "console", consoleObject);
        consoleObject.dispose();
        // Coded by OpenAI Codex. No module loader, timers, fetch, filesystem or host-global references.
    };

    // Coded by OpenAI Codex.
    const dispose = () => { returnSignal.dispose(); views.dispose(); formatter.dispose(); vm.dispose(); };
    const reset = () => { dispose(); initialize(); };
    initialize();

    const callView = (name: string, args: QuickJSHandle[] = []) => {
        const fn = vm.getProp(views, name);
        try { return vm.callFunction(fn, vm.undefined, ...args); }
        finally { fn.dispose(); }
    };

    // Each callback receives the same time, heap, output and pending-job limits as a submission.
    const execute = (operation: () => ReturnType<QuickJSContext["evalCode"]>, raw = false): Evaluation => {
        deadline = Date.now() + timeLimit;
        count = 0;
        outputBytes = 0;
        try {
            let result = operation();
            if (result.error && vm.eq(result.error, returnSignal)) {
                result.error.dispose();
                result = callView("takeResult");
            }
            if (result.error) {
                const error = vm.dump(result.error);
                result.error.dispose();
                const message = typeof error === "object" && error ? `${error.name || "Error"}: ${error.message || "Execution failed"}` : String(error);
                reset();
                return { ok: false, error: message.includes("interrupted") ? "Execution time limit exceeded (2 seconds)." : message.slice(0, 4000), reset: true };
            }
            const value = raw ? vm.getString(result.value) : format(result.value);
            result.value.dispose();
            const jobs = vm.runtime.executePendingJobs(100);
            if (jobs.error) {
                const error = vm.dump(jobs.error);
                jobs.error.dispose();
                reset();
                return { ok: false, error: String(error?.message || "Asynchronous execution failed."), reset: true };
            }
            if (vm.runtime.hasPendingJob()) {
                reset();
                return { ok: false, error: "Pending-job limit exceeded.", reset: true };
            }
            return { ok: true, value };
        } catch (error) {
            reset();
            return { ok: false, error: error instanceof Error ? error.message : String(error), reset: true };
        }
    };

    return {
        evaluate: (javascript: string) => execute(() => vm.evalCode(javascript, "terminal.js", { type: "global" })),
        nextFrame(): ViewFrame | undefined {
            const result = execute(() => callView("takeFrame"), true);
            if (!result.ok) throw new Error(result.error);
            return result.value ? JSON.parse(result.value) as ViewFrame : undefined;
        },
        dispatch(event: ViewEvent): Evaluation {
            return execute(() => {
                const args = [vm.newString(event.kind), vm.newNumber(event.id), vm.newString(event.value.slice(0, 8192)), vm.newNumber(event.frame)];
                try { return callView("dispatch", args); }
                finally { args.forEach(arg => arg.dispose()); }
            });
        },
        clearViews: () => execute(() => callView("clear")),
        reset,
        dispose,
    };
}
