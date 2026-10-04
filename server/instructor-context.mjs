// Coded by OpenAI Codex. Bound all learner-supplied state before sending it to the model.
export const emptyMemory = () => ({ note: "", direction: "", assessment: "" });
export const memoryLimits = { note: 500, direction: 200, assessment: 200 };

export function readMemory(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    if (Object.entries(memoryLimits).some(([key, limit]) => typeof value[key] !== "string" || value[key].length > limit)) return null;
    return Object.fromEntries(Object.keys(memoryLimits).map(key => [key, value[key].trim()]));
}

export function readCodeState(value) {
    if (!value || !["preserved", "cleared"].includes(value.variables) || !Array.isArray(value.executions) || value.executions.length > 3) return null;
    const executions = [];
    if (value.lastEvent !== undefined && (!value.lastEvent || value.lastEvent.trigger !== "event")) return null;
    if (value.executions.some(entry => entry?.trigger !== "submission")) return null;
    for (const entry of [...value.executions, ...(value.lastEvent !== undefined ? [value.lastEvent] : [])]) {
        if (!entry || typeof entry.source !== "string" || entry.source.length > 2000 ||
            !["success", "error", "not-run"].includes(entry.status) || !["compile", "runtime"].includes(entry.phase) ||
            !["submission", "event"].includes(entry.trigger) ||
            (entry.status === "success" && entry.phase !== "runtime") ||
            (entry.status === "not-run" && entry.phase !== "compile")) return null;
        const clean = { source: entry.source, status: entry.status, phase: entry.phase, trigger: entry.trigger };
        for (const [key, limit] of Object.entries({ result: 1000, output: 1000, error: 1200 })) {
            if (entry[key] !== undefined) {
                if (typeof entry[key] !== "string" || entry[key].length > limit) return null;
                clean[key] = entry[key];
            }
        }
        executions.push(clean);
    }
    const lastEvent = value.lastEvent !== undefined ? executions.pop() : undefined;
    return { executions, variables: value.variables, ...(lastEvent ? { lastEvent } : {}) };
}
