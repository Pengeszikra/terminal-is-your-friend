// Coded by OpenAI Codex. Only a standalone single-line comment addresses the instructor.
export function instructorQuestion(source: string): string | null {
    const trimmed = source.trim();
    return trimmed.startsWith("//") && !/[\r\n]/.test(trimmed) ? trimmed.slice(2).trim() : null;
}
