# Development and deployment

[Back to the learning guide](../README.md)

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
and asking a question shows a nonblocking unavailable status until the key is configured.

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
The instructor occasionally offers a runnable one-line demonstration with a visible
result, starting with numbers and strings for beginners. Pipelines are optional and
pass exactly one argument; functions requiring multiple arguments use ordinary calls.
Error guidance favors the smallest correction using existing variables and acknowledges
incorrect earlier advice instead of forcing currying or redeclaring a preserved `const`.
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
requests pause after a provider failure until an explicit question, reconnection or reset, avoiding a
repeated error loop. Each proactive message is a normal API call and consumes quota.
For failures, the instructor receives the complete submitted code (up to 8 KB / 100 lines),
the error message (up to 16,000 characters), and whether compilation or execution failed.
It is prompted to explain the likely cause and correction rather than repeat the error.
Explanations run in the background, so the learner can keep editing and executing code.

Each request carries a small, separate teaching memory instead of a mixed terminal transcript:

- `memory.note`: a free-form instructor notebook, up to 500 characters, covering demonstrated knowledge, learning preferences and difficulties.
- `memory.direction` and `memory.assessment`: one short sentence each (up to 200 characters) about the discussion's direction and the learner's understanding.
- `context`: the latest eight question/answer messages (roughly four exchanges), up to 1,200 characters each. Discussed examples are separate, with a combined 2,000-character budget; they are never labelled as executed code.
- `codeState`: the latest three submitted terminal attempts plus the latest callback event since the last attempt, with success/error/not-run status, compilation/runtime phase, return value, console output and error. Source is limited to 2,000 characters per record; results/output to 1,000 each and errors to 1,200. Truncated records are marked. Event records do not guess which submission defined the callback. Current error/review requests still carry complete source separately.

The instructor refreshes the notebook in its normal structured response, without an extra
summarization call. It preserves earlier useful observations as old chat leaves the window;
terminal facts take precedence over its notes. Invalid/missing notebook updates and refusals
retain the previous memory. Only fully presented, uncancelled replies commit new memory.
The terminal also tracks whether variables were preserved or cleared, so historical code
is not confused with current runtime state. This is bounded evidence, not a VM snapshot.
Notes and recent state live only in the current page's memory: a reload or `Reset session`
clears them; `Clear` and **Ctrl+L** only clear visible output. No account or database is needed.
The fixed teaching instructions still accompany every request; this bounds conversation
growth rather than removing all repeated input tokens.
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

The deployment has three parts:

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
Programs use TSX by default. The three terminal elements described in the [learning guide](../README.md#finally-make-it-interactive-with-tsx) are rendered through a narrow, validated bridge; user code still has no DOM access.

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

## Automatic release version

The build derives the displayed `YY-MM-NN` version from Git history in
`scripts/version.mjs`. `YY-MM` is the latest first-parent merge commit's year and
month in UTC; `NN` counts first-parent merge commits in that month, padded to at
least two digits. Before the first merge, the checkout's commit month uses `00`.

Use GitHub's **Create a merge commit** method when merging into `main`. Each such
merge produces a new version automatically in the normal Vercel build. Squash,
rebase and fast-forward integrations do not create merge commits and therefore do
not advance this merge counter. Feature previews show the most recent merge in
their first-parent ancestry; they do not reserve a future release number.

Rebuilding the same commit keeps its version, including after a month boundary.
No bot commit, counter file, secret or extra deployment is needed. The generated
HTML contains the version in its header and `application-version` meta tag.
The npm package's SemVer field is separate from this application's release label.

Vercel may provide source files without `.git`. For source-only or shallow checkouts,
the script fetches the exact deployment commit's history from this public GitHub
repository into a temporary bare repository. `VERCEL_GIT_COMMIT_SHA` identifies
the deployed commit when `.git` is absent; Vercel supplies it automatically. No
GitHub token is needed. The temporary history is removed after reading it, and
the original checkout stays untouched. A complete local clone needs no network.
Rebuilds stay pinned to their original commit even if `main` advances. Builds fail
with a clear error if the commit or its history is unavailable; a source ZIP needs
the matching `VERCEL_GIT_COMMIT_SHA`, or can be replaced with a Git clone.

## Installable app (PWA)

Use the browser's **Install app** / **Add to Home Screen** option on the HTTPS deployment.
The manifest opens TiyF in its own window. No PWA framework or extra dependency is needed.
A service worker precaches the app shell and sandbox WASM. Its cache key follows the build
contents; updates activate after existing app tabs/windows close, without reloading a session.
AI replies, submitted source and API responses are never cached. Installation/cache failure
does not prevent normal online use.

The AI mentor is optional: questions run in the background and never lock the editor, Reset
or program controls. Network, HTTP, malformed-response and timeout failures show one quiet
status message. Automatic requests pause; an explicit `//` question retries. New code cancels
stale mentor responses, and a late reply cannot unlock an unrelated compilation.

**This is not an offline TypeScript compiler.** The native pipeline fork still runs on the
server. Once cached, the app opens without internet and allows editing; controls in an already
running program continue to work. New code needs `/api/compile`. An offline submission keeps
its draft and explains that connection is needed. Reloading still clears session variables
and code, just as before. The offline app needs an earlier successful online visit to cache it.
