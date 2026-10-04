// Coded by OpenAI Codex. Session-only teaching notes; terminal facts stay separate.
export type InstructorMemory = { note: string; direction: string; assessment: string };
export type ChatEntry = { kind: "question" | "answer"; text: string; example?: string };
export type Execution = {
    source: string;
    status: "success" | "error" | "not-run";
    phase: "compile" | "runtime";
    trigger: "submission" | "event";
    result?: string;
    output?: string;
    error?: string;
};

const clip = (text: string, limit: number) => text.length > limit ? text.slice(0, limit - 14) + "\n[truncated]" : text;

export class InstructorSession {
    memory: InstructorMemory = { note: "", direction: "", assessment: "" };
    context: ChatEntry[] = [];
    codeState: { executions: Execution[]; lastEvent?: Execution; variables: "preserved" | "cleared" } = { executions: [], variables: "cleared" };

    remember(kind: string, text: string, example = "") {
        if (kind !== "question" && kind !== "answer") return;
        this.context.push({ kind, text: clip(text, 1200), ...(example ? { example: clip(example, 2000) } : {}) });
        this.context = this.context.slice(-8);
        // Keep examples distinct from executed code, with a total bounded example budget.
        let remaining = 2000;
        for (let i = this.context.length - 1; i >= 0; i--) {
            const entry = this.context[i];
            if (!entry.example) continue;
            if (remaining < 100) delete entry.example;
            else { entry.example = clip(entry.example, remaining); remaining -= entry.example.length; }
        }
    }

    record(execution: Execution, variables: "preserved" | "cleared") {
        const record = {
            ...execution,
            source: clip(execution.source, 2000),
            ...(execution.result !== undefined ? { result: clip(execution.result, 1000) } : {}),
            ...(execution.output !== undefined ? { output: clip(execution.output, 1000) } : {}),
            ...(execution.error !== undefined ? { error: clip(execution.error, 1200) } : {}),
        };
        if (execution.trigger === "event") this.codeState = { ...this.codeState, variables, lastEvent: record };
        else this.codeState = { variables, executions: [...this.codeState.executions, record].slice(-3) };
    }

    updateMemory(value: unknown) {
        if (!value || typeof value !== "object") return;
        const memory = value as InstructorMemory;
        if (typeof memory.note !== "string" || memory.note.length > 500 ||
            typeof memory.direction !== "string" || memory.direction.length > 200 ||
            typeof memory.assessment !== "string" || memory.assessment.length > 200) return;
        this.memory = { note: memory.note, direction: memory.direction, assessment: memory.assessment };
    }
}
