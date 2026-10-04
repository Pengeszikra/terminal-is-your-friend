// Coded by OpenAI Codex. Only these trusted DOM elements are created; no guest HTML or handlers cross realms.
import type { ViewFrame, ViewEvent } from "./view-runtime.js";

export function createViewScreen(element: HTMLElement, send: (event: ViewEvent) => void) {
    let current = 0;
    return {
        render(frame: ViewFrame) {
            current = frame.id;
            const content = document.createElement("code");
            for (const child of frame.children) {
                if (typeof child === "string") { content.append(document.createTextNode(child)); continue; }
                const event = (kind: "click" | "input", value = "") => send({ kind, id: child.id, value, frame: frame.id });
                if (child.tag === "button") {
                    const button = document.createElement("button");
                    button.type = "button";
                    button.textContent = child.text;
                    button.addEventListener("click", () => event("click"));
                    content.append(button);
                } else if (child.tag === "input") {
                    const input = document.createElement("input");
                    input.type = "text";
                    input.value = child.value;
                    input.placeholder = child.placeholder;
                    input.maxLength = 8192;
                    input.setAttribute("aria-label", child.placeholder || "Program input");
                    input.addEventListener("input", () => event("input", input.value));
                    content.append(input);
                }
            }
            const wasHidden = element.hidden;
            const hadFocus = element.contains(document.activeElement);
            element.classList.toggle("is-centered", frame.center === true);
            element.classList.toggle("is-small", frame.small === true);
            element.replaceChildren(content);
            element.hidden = false;
            const editor = document.querySelector<HTMLTextAreaElement>("#input");
            if (hadFocus || (wasHidden && document.activeElement === editor && !editor?.value)) element.focus({ preventScroll: true });
        },
        key(key: string) { send({ kind: "key", id: 0, value: key, frame: current }); },
        clear() { current = 0; element.replaceChildren(); element.hidden = true; },
    };
}
