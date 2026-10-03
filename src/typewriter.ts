// Coded by OpenAI Codex. Reveal trusted text nodes only; examples retain syntax highlighting.
import { highlight } from "./highlight.js";

export async function typewrite(prose: HTMLElement, sample: HTMLElement, text: string, code: string, signal: AbortSignal, progress: () => void) {
    const letters = Array.from(text);
    const codeLetters = Array.from(code);
    const total = letters.length + codeLetters.length;
    const step = Math.max(2, Math.ceil(total / 250));
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let cursor = reducedMotion ? total : Math.min(step, total);
    const draw = () => {
        prose.textContent = letters.slice(0, Math.min(cursor, letters.length)).join("");
        const visibleCode = codeLetters.slice(0, Math.max(0, cursor - letters.length)).join("");
        sample.parentElement!.hidden = !visibleCode;
        highlight(visibleCode, sample);
        prose.classList.toggle("is-typing", cursor < letters.length);
        sample.classList.toggle("is-typing", cursor >= letters.length && cursor < total);
        progress();
    };
    try {
        signal.throwIfAborted();
        draw();
        while (cursor < total) {
            await new Promise<void>((resolve, reject) => {
                const abort = () => { window.clearTimeout(timer); reject(new DOMException("Aborted", "AbortError")); };
                const timer = window.setTimeout(() => { signal.removeEventListener("abort", abort); resolve(); }, 20);
                signal.addEventListener("abort", abort, { once: true });
            });
            signal.throwIfAborted();
            cursor = Math.min(total, cursor + step);
            draw();
        }
    } finally {
        prose.classList.remove("is-typing");
        sample.classList.remove("is-typing");
    }
}
