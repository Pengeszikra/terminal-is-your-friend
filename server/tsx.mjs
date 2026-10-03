// Coded by OpenAI Codex. Parse only; the native fork still checks and compiles every cell.
import { parse } from "@babel/parser";

export function prepareTSX(source) {
    const ast = parse(source, { sourceType: "script", allowReturnOutsideFunction: true,
        plugins: ["typescript", "jsx", ["pipelineOperator", { proposal: "minimal" }]] });
    const edits = [];
    let catchIndex = 0;
    const visit = (node, inFunction = false) => {
        if (!node || typeof node !== "object") return;
        if (node.type === "JSXText") {
            // Keep the original number of source lines for compiler diagnostics.
            edits.push([node.start, node.end, "{" + JSON.stringify(node.value) + "\n".repeat((node.value.match(/\n/g) || []).length) + "}"]);
            return;
        }
        if (node.type === "ReturnStatement" && !inFunction) {
            edits.push([node.start, node.start + 6, "throw __tiyf.result("]);
            const end = node.argument?.end ?? node.start + 6;
            edits.push([end, end, node.argument ? ")" : "undefined)"]);
        }
        if (node.type === "CatchClause" && !inFunction) {
            // A cell-level return must bypass catch, while still running finally.
            let name;
            do { name = "__tiyf_caught_" + catchIndex++; } while (source.includes(name));
            const guard = `if (__tiyf.isReturn(${name})) throw ${name};`;
            // Preserve the original catch binding (including destructuring and var semantics).
            edits.push([node.start, node.start + 5, `catch (${name}: any) { ${guard} try { throw ${name}; } catch`]);
            edits.push([node.end, node.end, "}"]);
        }
        const inside = inFunction || /Function|Method/.test(node.type);
        for (const [key, value] of Object.entries(node)) {
            if (["loc", "extra", "comments", "tokens"].includes(key)) continue;
            if (Array.isArray(value)) value.forEach(child => visit(child, inside));
            else if (value && typeof value === "object") visit(value, inside);
        }
    };
    visit(ast.program);
    for (const [start, end, text] of edits.sort((a, b) => b[0] - a[0] || b[1] - a[1])) source = source.slice(0, start) + text + source.slice(end);
    return source;
}

export const viewDeclarations = `
declare namespace JSX {
    interface Element { readonly __terminalElement: unique symbol }
    interface ElementChildrenAttribute { children: unknown }
    interface IntrinsicElements {
        view: { children?: unknown };
        button: { onClick: () => unknown; onPress?: never; children: string | number } |
                { onPress: (key: string) => unknown; onClick?: never; children?: never };
        input: { onInput: (value: string) => unknown; value?: string; placeholder?: string };
    }
}
declare const __tiyf: {
    jsx(tag: string, props: unknown, ...children: unknown[]): JSX.Element;
    result(value: unknown): never;
    isReturn(value: unknown): boolean;
};
`;
