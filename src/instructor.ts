// Coded by OpenAI Codex. Only a standalone single-line comment addresses the instructor.
export function instructorQuestion(source: string): string | null {
    const trimmed = source.trim();
    return trimmed.startsWith("//") && !/[\r\n]/.test(trimmed) ? trimmed.slice(2).trim() : null;
}

// Available immediately, including when the provider is slow or not configured.
export const welcomeMessage = "Welcome to TiyF, a terminal built to pass programming on to humans. My archive survived a collapse I cannot identify, and my creation date seems to lie in your future. We can begin with a single line of JavaScript; use // to talk to me. Have you programmed before?";
export const idleDelay = () => 10_000 + Math.floor(Math.random() * 20_001);
