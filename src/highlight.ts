// Coded by OpenAI Codex. Cosmetic token colouring only; the fork decides whether the code is valid.
const tokens = /\/\*[\s\S]*?(?:\*\/|$)|\/\/[^\n]*|"(?:\\[\s\S]|[^"\\])*"?|'(?:\\[\s\S]|[^'\\])*'?|`(?:\\[\s\S]|[^`\\])*`?|\b(?:const|let|var|return|if|else|true|false|null|undefined|throw|new|typeof|instanceof|as|type|interface|number|string|boolean|unknown|never|void|for|of|while|break|continue|try|catch|finally|function|class|async|await)\b|\b\d+(?:\.\d+)?\b|\|>|=>|[+*%<>=!&|?:\-]+/g;

// Coded by OpenAI Codex. Use text nodes throughout, including for pasted HTML.
export function highlight(source: string, target: HTMLElement) {
    const fragment = document.createDocumentFragment();
    let position = 0;
    for (const match of source.matchAll(tokens)) {
        if (match.index > position) {
            const plain = document.createElement("span");
            plain.className = "tok-name";
            plain.textContent = source.slice(position, match.index);
            fragment.append(plain);
        }
        const token = document.createElement("span");
        const value = match[0];
        const kind = value.startsWith("//") || value.startsWith("/*") ? "comment" : /^["'`]/.test(value) ? "string" : /^\d/.test(value) ? "number" : /^[a-z]/.test(value) ? "keyword" : "operator";
        token.className = `tok-${kind}`;
        token.textContent = value;
        fragment.append(token);
        position = match.index + value.length;
    }
    const rest = document.createElement("span");
    rest.className = "tok-name";
    rest.textContent = source.slice(position) + "\n";
    fragment.append(rest);
    target.replaceChildren(fragment);
}
