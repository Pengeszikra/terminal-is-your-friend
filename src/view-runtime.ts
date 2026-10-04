// Coded by OpenAI Codex. This entire runtime runs inside QuickJS, never in the browser realm.
export const viewRuntimeSource = String.raw`(() => {
    const nodes = new WeakSet();
    const queue = [];
    const listeners = new Map();
    const active = new Map();
    const returnSignal = Object.freeze({});
    let returned;
    let sequence = 0;
    let bytes = 0;
    let frameId = 0;
    const text = value => String(value).slice(0, 8192);
    const flatten = (children, depth = 0) => {
        if (depth > 20) throw Error("View nesting limit exceeded.");
        const result = [];
        for (const child of children) {
            if (Array.isArray(child)) result.push(...flatten(child, depth + 1));
            else if (child === null || child === undefined || typeof child === "boolean") continue;
            else if (typeof child === "string" || typeof child === "number" || typeof child === "bigint") result.push(text(child));
            else if (typeof child === "object" && nodes.has(child)) result.push(child);
            else throw Error("Views accept text, numbers, buttons and inputs only.");
            if (result.length > 500) throw Error("View element limit exceeded.");
        }
        return result;
    };
    const jsx = (tag, props, ...children) => {
        props = props || {};
        const allowed = tag === "view" ? ["center", "small"] : tag === "button" ? ["onClick", "onPress"] : tag === "input" ? ["onInput", "value", "placeholder"] : null;
        if (!allowed) throw Error("Only <view>, <button> and <input> are supported.");
        for (const key of Object.keys(props)) if (!allowed.includes(key)) throw Error("Unsupported " + tag + " attribute: " + key);
        const content = flatten(children);
        if (tag === "view") {
            if (props.center !== undefined && typeof props.center !== "boolean") throw Error("The view center prop must be a boolean.");
            if (props.small !== undefined && typeof props.small !== "boolean") throw Error("The view small prop must be a boolean.");
            const size = JSON.stringify(content).length;
            if (size > 16384 || queue.length >= 1000 || bytes + size > 1000000) throw Error("View queue limit exceeded (1000 frames / 1 MB; 16 KB per frame).");
            queue.push({ children: content, size, center: props.center === true, small: props.small === true });
            bytes += size;
            return;
        }
        if (tag === "button" && props.onPress !== undefined) {
            if (typeof props.onPress !== "function" || props.onClick !== undefined || content.length) throw Error("A key listener needs onPress only and no text.");
            if (listeners.size >= 100) throw Error("Key listener limit exceeded (100).");
            listeners.set(++sequence, props.onPress);
            return;
        }
        if (tag === "button" && (typeof props.onClick !== "function" || !content.length || content.some(item => typeof item !== "string") || !content.join("").trim())) throw Error("A clickable button needs onClick and visible text.");
        if (tag === "input" && (typeof props.onInput !== "function" || content.length || (props.value !== undefined && typeof props.value !== "string") || (props.placeholder !== undefined && typeof props.placeholder !== "string"))) throw Error("An input needs onInput and optional string value/placeholder.");
        const node = Object.freeze({ tag, children: content, callback: tag === "button" ? props.onClick : props.onInput,
            value: props.value ?? "", placeholder: props.placeholder ?? "" });
        nodes.add(node);
        return node;
    };
    const takeFrame = () => {
        if (!queue.length) return "";
        const frame = queue.shift();
        bytes -= frame.size;
        active.clear();
        const children = frame.children.map(child => {
            if (typeof child === "string") return child;
            const id = ++sequence;
            active.set(id, { kind: child.tag === "button" ? "click" : "input", callback: child.callback });
            return { tag: child.tag, id, text: child.children.join(""), value: child.value, placeholder: child.placeholder };
        });
        return JSON.stringify({ id: ++frameId, center: frame.center, small: frame.small, children });
    };
    const dispatch = (kind, id, value, frame) => {
        if (kind === "key") {
            for (const callback of Array.from(listeners.values())) callback(text(value));
        } else if (frame === frameId) {
            const handler = active.get(id);
            if (handler && handler.kind === kind) {
                if (kind === "click") handler.callback();
                else handler.callback(text(value));
            }
        }
    };
    const clear = () => { queue.length = 0; bytes = 0; active.clear(); frameId++; };
    Object.defineProperty(globalThis, "__tiyf", { value: Object.freeze({ jsx, isReturn: value => value === returnSignal, result: value => { returned = value; return returnSignal; } }) });
    return { takeFrame, dispatch, clear, returnSignal, takeResult: () => { const value = returned; returned = undefined; return value; } };
})()`;

export type ViewFrame = { id: number; center: boolean; small: boolean; children: (string | { tag: "button" | "input"; id: number; text: string; value: string; placeholder: string })[] };
export type ViewEvent = { kind: "click" | "input" | "key"; id: number; value: string; frame: number };
