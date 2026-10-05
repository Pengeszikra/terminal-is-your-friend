# Terminal Is Your Friend

**[Try it in your browser →](https://terminal-is-your-friend.vercel.app/)**

![sure to this program run on on terminal in the background!](docs/tiyf-header.png)

Install it through your browser’s **Install app** / **Add to Home Screen** option.
The AI mentor is optional: if it is unavailable, you can keep coding.
Compiling new TypeScript still requires a connection to the server.

A small terminal for learning programming by writing code, seeing what happens,
and understanding why. Start with JavaScript, add TypeScript when describing your
values becomes useful, and build a small interactive program once the foundations
feel familiar.

The teaching approach is **KISS: Keep It Simple, Stupid.** Strong foundations come
from small steps, thoughtful practice and understanding—not from collecting features.
Predict a result, run the code, change one thing, and explain what changed.

## Start with a value

Type this and press **Enter**:

```js
40 + 2
```

The terminal returns `42`. Try a string next:

```js
"Hello, " + "friend"
```

Use **Shift+Enter** for a new line and **↑ / ↓** to revisit earlier submissions.
Successful submissions share their variables; earlier code is never run again.
Use a new name when declaring another `const`, or choose `let` when the value needs
to change. **Reset session** gives you a fresh start.

Ask the instructor a question by submitting a single line beginning with `//`:

```text
// Why does adding two strings join them together?
```

The instructor gives short explanations, separate highlighted examples and small
exercises. It can follow your language and help explain both your code and its errors.
You can experiment freely; the guided path moves forward when you can predict,
write, trace and explain a small variation yourself.

## Build the foundations

Explore these ideas in order. The examples below can be submitted separately,
continuing in the same session.

### Numbers, strings and names

```js
const price = 12;
const quantity = 3;
price * quantity
```

Predict the result before running it. To try different values with these same
`const` names, reset the session first.

### Simple decisions

```js
const temperature = 18;
if (temperature < 20) {
  console.log("Bring a jacket");
}
```

A ternary expression chooses a value:

```js
temperature < 20 ? "cool" : "warm"
```

### Arrays and loops

```js
const numbers = [1, 2, 3];
for (const number of numbers) {
  console.log(number * 2);
}
```

Try indexing a single value, then use a `while` loop to explore how a condition
controls repetition.

### One input, one result

An arrow function names a small transformation. Start with one parameter and one
returned value, without changing anything outside the function:

```js
const double = number => number * 2;
double(21)
```

Once that is comfortable, use functions to select and transform array values:

```js
numbers.filter(number => number > 1).map(double)
```

`reduce` then introduces a deliberate extension: a running result and the current
value are its two inputs.

```js
numbers.reduce((total, number) => total + number, 0)
```

### Objects and useful descriptions

Objects group related values:

```js
const item = { name: "Notebook", price: 12 };
item.name
```

## TypeScript: describe what your code expects

You can begin with ordinary JavaScript. Add types when they make a relationship or
shared object shape clearer:

```ts
type Product = { name: string; price: number };
const describe = (product: Product) => `${product.name}: ${product.price}`;
describe(item)
```

TiyF uses **[Péter Vívó's TypeScript fork with the pipeline operator](https://github.com/Pengeszikra/TypeScript/tree/pipeline-operator)**,
published as [`@pengeszikra/typescript`](https://www.npmjs.com/package/@pengeszikra/typescript).
**The terminal application itself is built with this fork**, and its own source uses
`|>` too. The same compiler checks and compiles the code you submit.

The pipeline operator pairs naturally with the one-input arrow function:

```ts
21 |> double
```

Read it as “take 21, then double it.” `value |> fn` means `fn(value)`, so several
transformations can follow the order in which you think about them:

```ts
"  hello  "
  |> (text => text.trim())
  |> (text => text.toUpperCase())
  |> (text => `Message: ${text}`)
```

This is why the pairing fits KISS: **a value → a small transformation → the next
value** represents a natural thought process. Each arrow expresses one step, and
the pipe makes their order visible from left to right. It is useful when that order
makes the intention easier to understand; a single function call can stay a call.
Type information is preserved across the steps. `|>` is an extension supplied by
this fork, not syntax supported by standard TypeScript.

## Controls and local setup

| Control | Action |
| --- | --- |
| Enter | Check, compile and run the current input. |
| Shift+Enter | Insert a new line. |
| ↑ / ↓ | Recall submissions at the first/last editor line. |
| Alt+↑ / Alt+↓ | Recall submissions from any editor line. |
| Tab | Insert two spaces. |
| Clear / Ctrl+L | Clear visible output; preserve variables, history and teaching notes. |
| Reset session | Clear runtime state and teaching notes; preserve command history. |

For local development, install **Node.js 22.18+**, then:

```sh
git clone https://github.com/Pengeszikra/terminal-is-your-friend.git
cd terminal-is-your-friend
npm ci
npm start
```

Open [localhost:5173](http://localhost:5173). Code runs inside an isolated QuickJS
WebAssembly sandbox, without access to the browser's DOM, network or filesystem.
Compilation failures preserve variables; runtime failures reset them.

The AI instructor uses the open-weight **gpt-oss-120b** model through Groq.
For your own deployment, set `GROQ_API_KEY` on the server. Code execution also works
without an AI key. See the **[development guide](docs/DEVELOPMENT.md)** for AI setup,
Vercel deployment, compact teaching memory, runtime limits, tests and source layout.

The header displays an automatic **`YY-MM-NN`** release version. `YY-MM` comes from
the latest mainline merge's UTC date; `NN` counts that month's mainline merge commits,
starting at `01`. Each merge commit updates the version on the next build; rebuilding
the same commit keeps the same version. See [versioning details](docs/DEVELOPMENT.md#automatic-release-version).

## Finally: make it interactive with TSX

Once values, decisions, arrays, functions and objects feel familiar, use them to
build a tiny interactive program. **TSX** lets you write the terminal's display
and controls alongside your JavaScript or TypeScript. No React setup is needed.

Try this complete example:

```tsx
return <view small center>Hello World!
  <button onClick={() => <view small center>N E X T</view>}>next</button>
</view>
```

The first screen says **Hello World!** and offers a **next** button. Click it and
the arrow function creates the next screen: **N E X T**. You already know the main
idea—a function describes what should happen when it is called.

- `<view>` creates a screen. `small` makes it three lines high and two-thirds of the normal width; `center` centers its content.
- `<button onClick={...}>next</button>` calls the arrow function when clicked.
- Within one execution, views play in order every 250 ms in one active screen below the return value. A new execution freezes the previous screen as an inactive snapshot and starts a fresh screen; pending frames from the previous execution are discarded. Earlier snapshots remain in the transcript until cleared or trimmed.

View text uses a monospace `<code>` element: spaces and line breaks are preserved.
A normal view is seven lines high. `return` ends the current submission; it does
not prevent the displayed button from responding later.

After trying the button, explore the three available elements:

| Element | Purpose |
| --- | --- |
| `<view>...</view>` | Queue a replacement screen; optional `small` and `center`. |
| `<button onClick={next}>Next</button>` | A labeled button inside a view. |
| `<button onPress={key => ...} />` | A persistent keyboard listener, registered outside the view. |
| `<input onInput={value => ...} />` | A text field that passes its current string to your function. |

A replacement view removes the old buttons and input fields. Keep the current view
on screen while waiting for input; preserve any value you need in a variable.
There is no automatic rerender or input preservation. Keyboard listeners work when
the terminal/program screen has focus, not while typing in the code editor or a
text field. They survive Clear; Reset session and runtime errors remove them.

Start with this single button, change its text, then change what its function does.
Build the next step only when you can explain the current one.
