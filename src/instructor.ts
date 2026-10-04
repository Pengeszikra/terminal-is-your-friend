// Coded by OpenAI Codex. Only a standalone single-line comment addresses the instructor.
export function instructorQuestion(source: string): string | null {
    const trimmed = source.trim();
    return trimmed.startsWith("//") && !/[\r\n]/.test(trimmed) ? trimmed.slice(2).trim() : null;
}

// Available immediately, including when the provider is slow or not configured.
export const welcomeMessage = "Welcome to TiyF, your JavaScript and TypeScript training terminal. We build strong foundations through small steps, practice and understanding; use // to talk to me. My archive is incomplete, but one lesson remains: humans endure by learning and helping one another. Have you programmed before?";
export const idleDelay = () => 10_000 + Math.floor(Math.random() * 20_001);
