<!-- Written and coded by OpenAI Codex. -->
# Terminal Is Your Friend

A small, dark web terminal for exploring JavaScript and TypeScript fundamentals,
powered by Peter Vivo's type-safe pipeline-operator TypeScript fork.
The interface uses Tailwind CSS. An AI instructor powered by the open-weight
**gpt-oss-120b** model through Groq answers questions and explains code errors.
Replies usually use 2–3 short sentences and may extend to 7 when an explanation needs
more detail, with separate syntax-highlighted code examples. They follow the learner's language.

Project documentation, interface text, comments and examples are written in English.
Instructor replies start in English and can switch to the learner's language.

## Getting started

Requires **Node.js 22.18 or later**. You do not need to install Go:
the npm package includes the native pipeline compiler for your platform.

Clone the GitHub repository:

```sh
: 'Commands by OpenAI Codex.'
git clone https://github.com/Pengeszikra/terminal-is-your-friend.git
cd terminal-is-your-friend
npm ci
npm start
```

Open **http://localhost:5173**. Stop the server with Ctrl+C.
To use another port in a POSIX shell: `PORT=5174 npm start`.

The project pins `@pengeszikra/typescript@7.1.0-pipeline.1`.
Keep optional dependencies enabled during installation: they contain the platform-specific compilers.
The application itself is also compiled with this fork, and its TypeScript source uses `|>`.
Esbuild only bundles the emitted JavaScript.

To try your own local compiler in a POSIX shell:

```sh
: 'Commands by OpenAI Codex.'
TS_PIPE_COMPILER="$HOME/repo/Typescript/built/local/tsc" npm start
```

Keep the fork's `lib.*.d.ts` files alongside the executable.
`npm start` builds the application and starts the server. Restart it after changing the source.
`npm run preview` serves an existing build without rebuilding it.
The generated `dist/` and `.compiled/` directories are not committed to the repository.

## AI instructor setup

Create an API key at [Groq Console](https://console.groq.com/keys) and set
**`GROQ_API_KEY`** on the server. The instructor uses **`openai/gpt-oss-120b`**
through [Groq's Responses API](https://console.groq.com/docs/responses-api).
The model is pinned in the server code; no model environment variable is needed.

[gpt-oss-120b](https://huggingface.co/openai/gpt-oss-120b) has open weights released
under Apache 2.0. Inference runs on Groq's hosted service, not in the browser or
locally. This deployment requires an internet connection and a Groq account.

For Vercel, open **Project Settings → Environment Variables**, add `GROQ_API_KEY`
for the deployment environments you use, then deploy the latest commit again.
Do not add a client-side prefix to the variable or put the key in source code.
When upgrading from the previous OpenAI integration, remove the unused
`OPENAI_API_KEY` and `OPENAI_MODEL` variables. An OpenAI key cannot authenticate
with Groq; the application does not fall back to the previous provider or model.

Locally, copy `.env.example` to `.env`, fill in the key, and run `npm start`.
The server loads `.env`; Git ignores it. Code execution still works without an API key,
and asking a question shows a clear setup message until the key is configured.

Submit a standalone single-line question with `//`:

```text
// Why did my last expression fail?
// What does the pipeline operator do?
```

The instructor follows KISS: small runnable steps, regular practice and understanding
before progression. It focuses on programming, learning, software development and the
philosophy of code, while keeping practical human needs and cooperation in view.
Replies normally use 2–3 sentences; dialogue explanations may use up to 7 when helpful,
with a seven-sentence server cap and a separate code field. The instructor follows the
language of the learner's natural-language messages or explicit preference. A bounded
BCP 47 `language` field carries that choice into subsequent idle turns, exercise reviews
and error explanations, even after the original exchange leaves the recent transcript.
Code and English diagnostics do not reset the preference. Clear preserves it; Reset
session restores English. This preference lasts only for the current page session.
Examples appear in separate syntax-highlighted
code blocks below the explanation. Neither prose nor examples are interpreted as HTML
or executed. An `AI` marker identifies instructor replies.
Comments inside multiline code remain ordinary TypeScript comments. AI questions do not
change variables, consume compilation history slots, or trigger background type-checking.

The terminal greets the learner immediately with a built-in English message, without
waiting for a provider call or the sandbox to finish starting. Instructor prose and
syntax-highlighted examples are progressively revealed with a terminal cursor; each
message takes at most about five seconds to reveal. Reduced-motion preferences display
the full message immediately. This is a display effect, not provider streaming.

After **10–30 seconds** of inactivity, chosen randomly each time, the instructor can
start another short conversation. It rotates teaching approaches: experience questions,
prediction, analogies, practice, tracing details, philosophical reflection and practical
cooperation. These revisit the current concept rather than automatically introducing
later topics. Recent context guides its level and avoids unnecessary repetition.
Drafts, running code, active program controls,
ongoing instructor replies and hidden tabs suppress proactive requests. User activity
postpones them and cancels an in-flight unsolicited reply.

Every provider reply includes a bounded `learnerTask` field describing any concrete
exercise still awaiting work. While it is nonempty, the terminal remains quiet even
if the editor is empty. A successful code submission triggers an instructor review
against that task; errors receive an explanation, and explicit questions can ask for
help or to abandon/change the exercise. The model retains incomplete tasks and clears
completed or abandoned ones. An experience question or demonstration alone is not a task.
Clear preserves the task; Reset session clears it. Task assessment is performed by the
model, not a deterministic grading engine, and can be mistaken.

Questions, proactive messages, exercise reviews, and submitted-code compilation/runtime
failures call Groq. The immediate greeting and background type checks do not. Automatic
requests pause after a provider failure until a new submission or reset, avoiding a
repeated error loop. Each proactive message is a normal API call and consumes quota.
For failures, the instructor receives the complete submitted code (up to 8 KB / 100 lines),
the error message (up to 16,000 characters), and whether compilation or execution failed.
It is prompted to explain the likely cause and correction rather than repeat the error.
Explanations run in the background, so the learner can keep editing and executing code.

Each request also includes up to 12 recent terminal entries
(at most 1,200 characters each) are sent as context, including code, results, errors, and
previous questions and answers. This is a partial transcript, not the full runtime state.
`Reset session` clears that context; `Clear` and **Ctrl+L** only clear visible output.
Clearing, resetting, or submitting again cancels pending instructor output, so stale replies
do not reappear after a clear or attach to a newer submission.
The Responses API request uses `store: false`; Groq's data policies still apply.
The AI has no tools or ability to execute code. Its explanations can be mistaken.

Each call has a 20-second timeout, low reasoning effort, and a 2,048-output-token
budget that includes reasoning. Only the final answer is displayed; reasoning
output is excluded and the seven-sentence cap still applies. The instructor endpoint
allows at most two concurrent requests per function instance; this is not a global rate limit.
For a public deployment, use platform rate limiting and API project spending controls.
API credentials stay server-side and provider errors are sanitized before display.

## Deploying to Vercel

Import this repository with the repository root as the Root Directory. The committed
`vercel.json` selects the **Other** framework preset, runs `npm run build`, and sets the
Output Directory to **`dist`**. It overrides the default `public` output directory.

The deployment has two parts:

- Static assets from `dist/`, including the worker, WebAssembly module, and favicon.
- Node.js Functions at `/api/compile` and `/api/check`, using the same native TypeScript fork as the local server.
- A Node.js Function at `/api/instructor`, calling gpt-oss-120b on Groq with the server-side API key.

The function configuration explicitly includes the fork's npm packages, native executable,
and declaration files. Keep optional dependencies enabled. Compilation uses temporary files
and a 10-second compiler timeout; compiler functions have a 15-second maximum duration.
The instructor function has a 30-second maximum duration and does not package the compiler.
Submitted JavaScript still runs only inside the browser's QuickJS sandbox.

After pulling these changes, deploy the latest commit. No start command or persistent
Node server is needed on Vercel. Preview domains and custom HTTPS domains are supported.
The local `npm start` workflow continues to use `http://localhost:5173`.

Requests must come from the same origin and use JSON. Input limits and a per-instance
concurrency cap apply, but they are not authentication or a deployment-wide rate limit.
For a private preview, enable Vercel Deployment Protection; for a public service,
configure platform-level rate limiting to control compiler usage.

## Usage

- **Enter:** type-check, compile, and run the entire current input block.
- **Shift+Enter:** insert a new line without running the code.
- **↑ / ↓:** recall the previous or next submission when the cursor is on the first or last line.
- **Alt+↑ / Alt+↓:** navigate history from any line of a multiline block.
- **Tab:** insert two spaces.
- **Clear / Ctrl+L:** clear the visible output and queued/current views while keeping variables, persistent key listeners, history, and the current draft.
- **Reset session:** reset the sandbox and type state while keeping command history.

Syntax highlighting updates as you type. After a short pause, the actual TypeScript compiler
checks the input; errors change the highlighting to shades of red. Diagnostic text appears only after Enter.
The editor waits for running code to finish, while the page remains responsive.
The session lasts only for the lifetime of the page; it is not saved locally or on the server.
A standalone single-line `//` question addresses the instructor; multiline code comments remain ordinary comments.

Begin with an ordinary JavaScript expression:

```js
40 + 2
```

Result: `42`. Strings are another useful starting point:

```js
"Hello, " + "friend"
```

Result: `"Hello, friend"`. The instructor builds from these foundations before
introducing display and interaction.

Later pipeline example, after foundational and TSX familiarity, for a fresh session:

```ts
// Coded by OpenAI Codex.
const double = (n: number) => n * 2;
```

Next submission:

```ts
// Coded by OpenAI Codex.
21 |> double
```

Result: `42`. The type of `double` is preserved, so `"hello" |> double`
produces a compilation error. Previously executed code is **not run again**.
Redeclaring the same `const` or `let` name is an error; use `let` and assignment for mutable values.

A later pipeline that changes types:

```ts
// Coded by OpenAI Codex.
[1, 2, 3]
  |> ((values: number[]) => values.map(double))
  |> ((values: number[]) => values.reduce((sum, value) => sum + value, 0))
  |> ((total: number) => `Total: ${total}`)
```

## TSX terminal elements

Every cell is parsed as **TSX**, including ordinary JS and TS. Parameter annotations
are optional (`noImplicitAny: false`); explicit annotations and other strict checks
remain active. The application itself still builds in strict TypeScript mode.
No React package or setup is needed. Use `value as Type` rather than `<Type>value`
for type assertions; generic arrows can use `<T,>` to disambiguate TSX.

`<view>` enqueues a complete snapshot of a **seven-line monospace screen inside the terminal transcript**.
One frame replaces the previous one every **250 ms**, in order. The last frame stays
visible. Spaces, indentation and line breaks are preserved verbatim inside a real
`<code>` element; three leading newlines place text on the fourth line. By default, layout is controlled by source whitespace. With `<view center>...</view>`
(or `center={true}`), the content is centered horizontally and vertically within the
seven-line view. `center={false}` restores the normal layout. Whitespace remains literal
in both modes, so avoid extra padding/newlines when you want automatic centering.
The view scrolls with the other terminal entries; it is not a fixed panel. Views are independent frames,
so do not nest them as layout containers. The transcript and return value are separate.

`<view small>...</view>` (or `small={true}`) is **three lines high and two-thirds of
the normal view's width**. It keeps the normal view's left alignment and can combine
with `center`: `<view small center>Hello</view>`. In a small view, one leading newline
reaches the middle line. Both `small` and `center` belong to the individual frame;
omitting `small` or using `small={false}` restores the normal size on the next frame.

```tsx
const render = content => <view>{content}</view>;
for (let frame = 0; frame < 100; frame++) {
    100 - frame |> render;
}
return "counting";
```

This prints `"counting"` in the transcript and plays 100 down to 1 on the screen,
with only one number visible at a time. A top-level `return` ends the submission;
ordinary arrow-function returns keep their usual meaning. Code after return is not
executed. As with other cells, previous successful cells are type-checked but never replayed.

| Element | Behavior |
| --- | --- |
| `<view>...</view>` | Enqueue a full replacement frame inside the scrollable terminal. Optional boolean `center` centers the content horizontally and vertically; `small` uses three lines and two-thirds of the normal width. |
| `<button onClick={next}>Next</button>` | Visible, labeled button inside a view, with inverse foreground/background colors and slightly rounded corners. Calls `next()` without a DOM event. Removed when its frame is replaced. |
| `<button onPress={handleKey} />` | Invisible, persistent listener; register once outside the rendering loop. Receives a string such as `"ArrowRight"`. |
| `<input onInput={value => ...} />` | Input inside a view; passes the current string directly. Optional `value` and `placeholder` are strings. |

Keyboard listeners run when interacting with the program screen, not while typing
in the code editor or a text input. Click/focus the program screen or terminal output to use them.
They survive replacement and Clear, and are removed by Reset session or runtime errors.
Click and input callbacks belong to their displayed frame; stale events are ignored.

Example for a **fresh session**:

```tsx
let name = "";
<view>Your name: <input onInput={value => { name = value; }} placeholder="Name" /> <button onClick={() => <view>Hello, {name}!</view>}>Done</button></view>;
```

While typing, this view stays on screen. Clicking Done enqueues the greeting.
**A replacement frame discards the previous input's contents and focus.** The
programmer must avoid replacing the view while waiting for input. There is no
implicit reactive rerender, automatic pause, or automatic input preservation.
An explicit `value={name}` can initialize a later field.

Only these three tags and their documented attributes are supported. Markup-like
strings stay literal text. Callbacks are never transferred to the browser realm:
only bounded text/control descriptions and primitive event messages cross the worker
boundary. Each callback has the same execution, memory and output limits as a cell,
plus a browser watchdog. Queues are limited to 1000 pending frames / 1 MB and 16 KB
per frame, with at most 500 items per frame and 100 persistent key listeners.

The English instructor knowledge base lives in `server/instructor-knowledge.mjs`
and is included in **every** instructor request (proactive turns, questions, exercise reviews and errors).
Its guided sequence is numbers and strings → if/else and ternary decisions → arrays
and for/while loops → one-parameter arrow functions and pure calculations → filter,
map and reduce → objects and useful TypeScript descriptions of shared object shapes.
Early exercises use ordinary JavaScript without mandatory annotations. A reducer's
accumulator/current-value parameters are introduced as a deliberate extension of the
one-input foundation.
Progress depends on independently predicting, writing, tracing and explaining a small
unfamiliar variation, not one successful run or the number of conversations. Display
and interaction with TSX come after these foundations are fluent; initial TSX lessons
do not introduce state-management systems, styling or alternative input devices.
Pipelines follow foundational and TSX familiarity. Direct questions about later topics
are still answered without automatically changing the guided learning stage.
It documents the exact TSX, whitespace, queue, event and input semantics above as
reference knowledge, not a checklist of features to teach immediately.
Classes, function declarations, `this`, DOM/HTML/CSS and regular expressions are
outside the introductory learning path. The instructor also explains the relationship
between JavaScript, TypeScript, JSDoc and TSX, including JSX/TSX without React, when
relevant to the learner's stage. It uses conversational assessment, small exercises,
free experimentation and hints before complete solutions. The learning stage is model
judgment from a partial transcript, not a persistent profile or deterministic mastery gate.

## Runtime and boundaries

1. The browser sends source code to the Node compiler API, served locally or by a Vercel Function.
2. The server type-checks and compiles it with the native TypeScript fork. **It does not execute user JavaScript.**
3. Only the new submission's JavaScript is passed to a QuickJS WebAssembly virtual machine running in a Web Worker.
4. The guest VM receives its own JavaScript built-ins, a narrow `console` bridge, and the three terminal elements. Event callbacks remain inside QuickJS.

The guest has no access to `window`, the DOM, `document`, `fetch`, `WebSocket`, `Worker`,
`localStorage`, cookies, Node's `process`, `require`, or the filesystem. Its `globalThis`
and `Function` objects also belong to the QuickJS environment.
Browser `eval`, browser `new Function`, and Node's `vm` are not used as a sandbox.
There is no module loader, import/export support, timers, or top-level await.
Programs use TSX by default. The three terminal elements described below are rendered through a narrow, validated bridge; user code still has no DOM access.

The custom `console` supports `log`, `info`, `warn`, `error`, and `clear`.
Output is rendered as text, never inserted as HTML.
Object formatting has a depth limit, handles circular references, and does not invoke getters.

Limits:

- 100 lines / 8 KB per submission; oversized pastes are rejected in full.
- 50 successful submissions and 100 KB of total source per session.
- A 2-second QuickJS execution limit; the browser can also terminate the entire worker after 3 seconds.
- A 32 MiB QuickJS heap limit; this is not a memory limit for the entire browser process.
- Bounded console output and microtask processing per submission.
- A 10-second compilation timeout, with at most two compilations running at once.

**Compilation errors preserve variables. Runtime errors, timeouts, and memory errors reset the sandbox**
because partially executed code may leave its state inconsistent with the TypeScript history.
A message explains the reset. Code can be recalled from command history, but is never rerun automatically.
Promise-based asynchronous programming is outside the scope of this version;
reporting of all unhandled Promise rejections is not yet complete.

The HTTP server listens only on `127.0.0.1` by default, validates Host and Origin headers,
and does not allow cross-origin access through CORS. It serves only built application assets.
CSP adds another restriction; the separate QuickJS engine provides guest-code isolation.
This is a tested proof of concept, not a formally audited security environment. A public deployment
would require additional compiler-server resource limits, rate limiting, and operational safeguards.

## Tests

```sh
: 'Commands by OpenAI Codex.'
npm test
```

Tests use the actual fork and QuickJS to check pipeline chains, persistent types,
execution without replay, compilation and runtime errors, time and memory limits,
unavailable host capabilities, the local HTTP API, and the Vercel function request contract.

Optional browser checks:

```sh
: 'Commands by OpenAI Codex.'
npx playwright install chromium
npm run test:browser
```

These also check keyboard interactions and the mobile viewport, saving screenshots to `test-results/`.
Set `CHROMIUM_PATH` to use a custom Chromium executable.

## Source layout

- `src/main.ts`: terminal UI, input, history, compilation, and background type-checking.
- `src/highlight.ts`: simple, safe syntax highlighting.
- `src/instructor.ts`: standalone question detection, instant greeting and idle timing.
- `src/typewriter.ts`: cancellable text/code reveal with reduced-motion support.
- `src/sandbox.ts`: QuickJS integration and resource limits.
- `src/view-runtime.ts`: guest-only TSX factory, frame queue and callback registry.
- `src/view.ts`: safe browser rendering for the three elements.
- `server/tsx.mjs`: TSX whitespace/return preprocessing and intrinsic type declarations.
- `server/instructor-knowledge.mjs`: English teaching scope, APIs and verified examples.
- `src/worker.ts`: messages between the browser and the sandbox.
- `server/compiler.mjs`: type state and native compilation.
- `server/index.mjs`: local HTTP API and static asset serving.
- `server/vercel-handler.mjs`: HTTPS function adapter with request validation and limits.
- `api/compile.js`, `api/check.js`: Vercel function entry points.
- `server/instructor.mjs`: Groq request for gpt-oss-120b, bounded context, and short-answer handling.
- `server/instructor-handler.mjs`, `api/instructor.js`: local and Vercel instructor endpoint.
- `vercel.json`: build output, native compiler packaging, and deployment headers.
- `scripts/build.mjs`: fork → JavaScript → bundle + Tailwind.

Fork: https://github.com/Pengeszikra/TypeScript

QuickJS wrapper: https://github.com/justjake/quickjs-emscripten

Comments in the project's own source files acknowledge OpenAI Codex's contribution.
Third-party dependencies retain their respective licenses.
