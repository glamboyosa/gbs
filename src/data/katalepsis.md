# Katalepsis: making coding agents prove UI work

Notes on the open source tool I designed and built so coding agents check their frontend work in a real browser. Code: [github.com/glamboyosa/katalepsis](https://github.com/glamboyosa/katalepsis). Article: [How to make your coding agent check its work in the browser](https://www.freecodecamp.org/news/how-to-make-your-coding-agent-check-its-work-in-the-browser/).

## The one-minute version

Coding agents report frontend work as verified once the build, the type check and the unit tests pass. Those checks miss what users actually see: a button covered by another element, a filter that leaves stale rows on screen, a save that disappears on refresh. If a change makes a claim about how the page behaves, the running page has to be part of the evidence.

Katalepsis runs that check against a preview deployment and writes an evidence report for the pull request. It has two modes. `run` executes the project's existing Playwright tests. `verify` lets a model drive a real browser through checks written in plain English. Both write the same report: every check ends as passed, failed or blocked, with the screenshot, video and trace behind it, and anything that never ran is listed as not tested.

The core idea is in `verify`. The model can click, type and run assertions, but it can't decide the result. Its verdict is a claim that has to cite assertions Katalepsis ran in the browser. A plain function checks the claim, and a pass only counts when it shows something the model caused, compared against an untouched copy of the page.

The name comes from Stoic philosophy: katalepsis is grasping something so clearly that you can't be wrong about it.

## The problem

I kept seeing the same pattern with agents. The agent finishes a UI change, runs the build and the tests, and reports that everything works. Then I open the page and find one of these:

- a control overlapped by another element, so it can't be clicked;
- state that changed in memory but never reached the screen;
- a list that still shows old data after a filter;
- a form that looks saved until you refresh.

Unit and end-to-end tests catch some of this when someone wrote the right test. Often nobody did. And when an agent does open a browser, its "it looks right" is an opinion with nothing to inspect afterwards.

So I wanted three things:

1. A real browser against the real preview, for every UI change.
2. Evidence a reviewer can open: screenshots, video, traces, and the exact assertions that ran.
3. Results an agent can't talk its way into. A pass needs proof.

## What it does

```text
coding agent or human
   |                         |
   CLI                       MCP server (3 tools, confined to --root)
   |                         |
   katalepsis run            katalepsis verify
   (your Playwright tests)   (plain-English checks, model drives the browser)
              \             /
         artifacts/katalepsis/<run-id>/
         report.html · report.md · manifest.json · evidence/
```

**`katalepsis run`** runs the project's own Playwright tests against a preview URL. No AI key is involved. The project's Playwright config reads the URL from an environment variable:

```ts
// playwright.config.ts
use: {
  baseURL: process.env.KATALEPSIS_BASE_URL ?? "http://localhost:3000",
  screenshot: "only-on-failure",
  video: "retain-on-failure",
  trace: "retain-on-failure",
},
```

**`katalepsis verify`** covers behaviour nobody has written a test for. Each check has an intent and a pass condition:

```json
{
  "checks": [
    {
      "id": "invalid-email",
      "name": "Invalid email",
      "intent": "Fill the name, enter an invalid email address and submit",
      "passCondition": "An email validation error is visible and the success confirmation is not shown"
    }
  ]
}
```

It works with an Anthropic, OpenAI or OpenRouter key, stored in the OS keychain with `katalepsis auth set` or read from an environment variable. Keys never go on the command line.

**The MCP server** gives Claude Code, Codex or Cursor three tools: run the tests, run agent checks, and read a report. It only works inside the folder it is given with `--root`. The full details are in "The MCP server" below.

**Outcomes.** Every check ends as passed, failed or blocked, and anything that never ran goes in a separate not-tested list:

- **passed**;
- **failed:** the app is wrong;
- **blocked:** Katalepsis couldn't check, for example the preview was down, a budget ran out, or the model claimed a result without evidence;
- **not tested:** with a reason, such as a skipped test.

Blocked is the outcome that makes the reports trustworthy. A broken preview never shows up as an app bug, and an unproven claim never shows up as a pass.

## Design principles

1. **Playwright is the judge for `run`.** Katalepsis reads Playwright's JSON output and never reinterprets an assertion. It adds classification and a report.
2. **The model's verdict is a claim.** In `verify`, the browser assertions are the evidence, and a deterministic function decides.
3. **Infrastructure problems are blocked, app problems are failed.** That distinction is what tells a reviewer whether to fix the app or the environment.
4. **One report shape.** Playwright results and model results both decode into the same schema before anything is written.
5. **Safe by default.** Navigation stays on the preview's origin, query strings are redacted, evidence paths can't escape the bundle, and the MCP server can't leave its root folder.

## Architecture

A pnpm monorepo in TypeScript with five packages:

| Package | What it holds |
| --- | --- |
| `core` | Result schemas, the Playwright runner and report ingest, the evidence store, the HTML and Markdown renderers |
| `agent` | Agent checks: browser tools, evidence rules, model clients |
| `credentials` | Keys from the environment or the OS keychain, and non-secret preferences |
| `mcp` | The stdio MCP server |
| `cli` | The `katalepsis` command |

The repo also has `apps/demo-form`, a signup form with a deliberate bug, three Playwright tests and a `checks.json`, so every feature has a real target.

The libraries, and why each one:

- **Playwright** for the browser, because projects already use it, and its traces and videos are the evidence reviewers want.
- **Effect** for errors, cancellation and dependencies. Running Playwright and probing a preview have many ways to fail, and Ctrl-C has to clean up exactly what this process started.
- **Effect Schema** for the report format. There is one `VerificationRun` shape, and every run decodes into it.
- **Vercel AI SDK** for the model loop, so the same code works with Anthropic, OpenAI and OpenRouter.

## The `run` path

1. **Probe the preview.** One request before Playwright starts. A network error, or an HTTP 502, 503 or 504, blocks every selected test, and Playwright never runs.

   ```ts
   const UNAVAILABLE_STATUSES = new Set([502, 503, 504]);

   const response = await fetch(url, {
     redirect: "manual",
     signal: AbortSignal.any([signal, AbortSignal.timeout(30_000)]),
   });
   if (UNAVAILABLE_STATUSES.has(response.status)) {
     return { reachable: false, reason: `the preview answered with HTTP ${response.status}` };
   }
   ```

2. **Run the project's Playwright** with its own config and `--reporter=json`, passing the preview URL in `KATALEPSIS_BASE_URL`. If the config hard-codes `baseURL`, Katalepsis warns, because the tests would never hit the preview.
3. **Classify each result.**
   - A failure because the preview's own origin was unreachable is blocked.
   - A failure because a third-party API was down stays failed, because that is a real problem with the app.
   - A browser that couldn't start is blocked.
   - A test that passed on retry is passed and marked flaky, with every attempt listed.
   - Skipped or filtered tests are not tested.
4. **Check the commit.** The preview can report its commit in an `x-commit-sha` header or a `<meta name="commit-sha">` tag, or the caller passes `--preview-commit`. The result is confirmed, mismatched or unknown. A mismatch blocks an otherwise passing run, because the tests ran against different code.
5. **Write the report.**

## The `verify` path

For each check, Katalepsis opens a fresh browser context with tracing on, gives the model the check's intent and pass condition, and lets it act.

**The model gets seven tools:** `navigate`, `snapshot`, `click`, `fill`, `press`, `assert` and `finish`. Nothing else.

**Assertions run in the browser, by Katalepsis.** When the model calls `assert`, Katalepsis runs the check itself, takes a screenshot, and records the result under an ID such as `a3`. The model's description of the page is never evidence.

**Two browser contexts.** Each check opens two copies of the start page. The model works in context A. Context B stays untouched. When the model asserts that an element is visible, Katalepsis also looks for it on the untouched copy. If it was already there, the assertion is marked `trueAtStart: true`. This stops a pass based on something that was always on the page, like a field label that happens to match the pass condition.

**The verdict is a claim with citations.** The model ends with `finish`, and it has to cite assertion IDs:

```ts
finish: tool({
  description: "Report the verdict once, citing assertion IDs such as a1.",
  inputSchema: schema(
    Schema.Struct({
      verdict: Schema.Literals(["passed", "failed", "blocked"]),
      summary: Schema.String,
      assertionIds: Schema.Array(Schema.String),
    }),
  ),
  execute: (verdict) => {
    onFinish(verdict);
    return "Recorded.";
  },
}),
```

**A plain function decides.** `decideOutcome` takes the claim, every recorded assertion, and any interruption, and returns the status. No model is involved.

## How a claimed pass is decided

A claimed pass stands only when all of these hold:

1. **Every cited ID is real.** Citing an assertion that never ran is blocked.
2. **Every cited assertion passed.**
3. **Nothing failed after the cited evidence.** Failed guesses before it are normal: a model often tries a few wordings before it finds the real message. A failure after the last cited assertion means the latest evidence disagrees.
4. **Something visible is cited.** Citing only hidden or URL assertions is blocked.
5. **The model caused it.** If every cited visible assertion was `trueAtStart`, the pass is blocked. Checks marked `observeOnly`, which are about the page as it loads, skip this rule.

The rules in code, trimmed:

```ts
if (!cited.every((a) => a.passed))
  return "The agent reported a pass, but a cited assertion failed.";

const lastCited = Math.max(...cited.map(position));
const laterFailures = assertions.filter(
  (a) => !a.passed && !citedIds.has(a.id) && position(a) > lastCited,
);
if (laterFailures.length > 0) return "...a later assertion failed";

const shown = cited.filter((a) => a.expectation === "visible");
if (shown.length === 0) return "...citing only hidden or URL assertions.";

if (!observeOnly && shown.every((a) => a.trueAtStart === true))
  return "...everything it cited was already on the page before it acted.";

return null; // the pass stands
```

A claimed fail needs evidence too: at least one cited assertion that actually failed. A model that stops without a verdict, hits a budget, or leaves the allowed origins is blocked, with the reason in the report.

## The report

Every run writes one folder inside the project being checked:

```text
artifacts/katalepsis/<run-id>/
  report.html        open in a browser; evidence is linked by relative path
  report.md          paste into the PR description or a comment
  manifest.json      the validated results, schema version 1
  evidence/<check-id>/   screenshots, videos, traces, each with its SHA-256 in the manifest
  evidence/run/playwright.log
```

Every check, from either mode, decodes into one schema before anything is written:

```ts
// packages/core: the check shape (simplified; the real one also has titlePath, file, durationMs and more)
export const CheckStatus = Schema.Literals(["passed", "failed", "blocked"]);

export const VerificationCheck = Schema.Struct({
  id: Schema.String,
  source: Schema.Literals(["playwright-test", "agent"]),
  title: Schema.String,
  status: CheckStatus,
  flaky: Schema.Boolean,
  failure: Schema.NullOr(Schema.Struct({ code: FailureCode, message: Schema.String })),
  attempts: Schema.Array(Attempt),
  evidence: Schema.Array(BundlePath),
});
```

Details that matter in practice:

- Tests that never ran go in a `notTested` list with a reason.
- `BundlePath` rejects absolute paths and `..` segments, so evidence can't point outside the bundle.
- Query values in the preview URL are redacted from every text file. Preview hosts often put bypass tokens there.
- Exit codes are scriptable: `0` every check passed, `1` at least one failed, `2` blocked, `3` usage or setup error, `4` the report couldn't be written.

## The MCP server

The MCP server is how a coding agent uses Katalepsis without a human typing commands. It is a local stdio server in `packages/mcp`, built on version 2 of the MCP TypeScript SDK.

### Three high-level tools

| Tool | What it does |
| --- | --- |
| `verification_run_tests` | Runs the project's Playwright tests against `baseUrl`. Optional `cwd`, `project`, `grep`, `timeoutSeconds` and `installBrowsers`. No AI key needed. |
| `verification_check_browser` | Runs agent checks (`id`, `name`, `intent`, `passCondition`) against `baseUrl` with the locally configured provider and model. Optional `provider`, `model`, `allowOrigins`. |
| `verification_get_report` | Reads an earlier run by `runId`, as a summary, the Markdown report or the manifest. |

Each run tool returns the run ID, the status, the counts, every check's result, what wasn't tested, and the paths to `report.html`, `report.md` and `manifest.json`.

The server exposes whole verifications and keeps raw browser control to itself. An agent calling it gets the same evidence rules as the CLI, and it has no way to click its way to a pass.

### One schema for validation and for what the client sees

Tool inputs are Effect Schemas. The same definition validates the arguments and produces the JSON Schema the client sees, so the two can never drift apart:

```ts
// packages/mcp/src/tools.ts (trimmed)
export const RunTestsInput = Schema.Struct({
  baseUrl: Url,
  cwd: Schema.optionalKey(ProjectPath),
  project: Schema.optionalKey(Schema.Array(Schema.String)),
  grep: Schema.optionalKey(Schema.String),
  timeoutSeconds: Schema.optionalKey(Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 3600 }))),
  installBrowsers: Schema.optionalKey(Schema.Boolean),
});

export const CheckBrowserInput = Schema.Struct({
  baseUrl: Url,
  // The checks file schema, so duplicate IDs and bad fields are rejected the same way.
  checks: ChecksFile.fields.checks,
  cwd: Schema.optionalKey(ProjectPath),
  model: Schema.optionalKey(Schema.String.check(Schema.isNonEmpty())),
  allowOrigins: Schema.optionalKey(Schema.Array(Url)),
});

const toolInput = (schema) => {
  // Unknown keys are rejected, so a stray field such as an API key is never silently ignored.
  const validation = Schema.toStandardSchemaV1(schema, {
    parseOptions: { onExcessProperty: "error" },
  })["~standard"];
  const json = Schema.toStandardJSONSchemaV1(schema)["~standard"].jsonSchema;
  // ...closes every object in the JSON Schema with additionalProperties: false
};
```

Each tool also carries MCP annotations. `verification_get_report` is marked read-only. The two run tools are marked as writing (they create a report folder) and as reaching out to the open world (they load the preview).

### It stays inside its root folder

Every `cwd` an agent passes is resolved against the root the server was started with. Symlinks are resolved first, so a link can't point the server somewhere else:

```ts
// packages/mcp/src/server.ts
/** Resolves a project directory and refuses anything outside the workspace root, symlinks included. */
const projectDir = async (root: string, cwd: string | undefined): Promise<string> => {
  const resolved = await realpath(path.resolve(root, cwd ?? ".")).catch(() => {
    throw new ToolError(`No such directory inside the workspace: ${cwd ?? "."}`);
  });
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    throw new ToolError("cwd must be inside the workspace root this server was started with.");
  }
  return resolved;
};
```

The report folders get the same treatment. `artifacts/katalepsis` must be a real directory, so reports are never written or read through a link.

### One verification at a time

Two runs at once would fight over browsers and ports. The server holds one lock, and a second call gets a clear answer it can act on:

```ts
// packages/mcp/src/server.ts
const exclusive = (work: () => Promise<CallToolResult>): Promise<CallToolResult> => {
  if (current !== null) {
    const seconds = Math.round((Date.now() - current.startedAt.getTime()) / 1000);
    return Promise.resolve(
      failure(`Another katalepsis run started ${seconds}s ago and is still going. Try again when it finishes.`),
    );
  }
  const done = work().finally(() => {
    current = null;
  });
  current = { startedAt: new Date(), done };
  return done;
};
```

The SDK validates arguments before the handler runs, so a malformed call never takes the lock. Cancellation flows through too: each tool passes the MCP request's abort signal into the run, so a cancelled call stops Playwright and its browsers.

```ts
server.registerTool("verification_run_tests", TOOLS.verification_run_tests, (input, ctx) =>
  guarded(() => runTests(input, ctx.mcpReq.signal)),
);
```

### Timeouts

Runs take minutes, and clients give up on slow tools. The setup examples raise the client timeout to 10 minutes. The server stops a test run after 9 minutes by default, so it always reports before the client times out. Agent checks also stop after 9 minutes in total, and any checks not reached are reported as not run.

### Setting it up

**Claude Code.** Either one command:

```bash
claude mcp add katalepsis -- katalepsis-mcp --root /path/to/your-app
```

or a `.mcp.json` at the project root. Without `--root`, the server uses `CLAUDE_PROJECT_DIR`, which Claude Code sets to the open project, so this file names no machine-specific path and can be committed:

```json
{
  "mcpServers": {
    "katalepsis": {
      "command": "katalepsis-mcp",
      "timeout": 600000
    }
  }
}
```

**Codex.**

```bash
codex mcp add katalepsis -- katalepsis-mcp --root /path/to/your-app
```

Then raise the timeout in `~/.codex/config.toml`. Codex waits 60 seconds by default, and `codex exec` can't ask for approval, so it needs to be told:

```toml
[mcp_servers.katalepsis]
command = "katalepsis-mcp"
args = ["--root", "/path/to/your-app"]
tool_timeout_sec = 600
default_tools_approval_mode = "approve"
# Only needed if the key is in an environment variable rather than the keychain.
env_vars = ["OPENROUTER_API_KEY"]
```

**Cursor.** In `.cursor/mcp.json`. This follows Cursor's documentation; I've tested the server with Codex.


```json
{
  "mcpServers": {
    "katalepsis": {
      "type": "stdio",
      "command": "katalepsis-mcp",
      "args": ["--root", "/path/to/your-app"]
    }
  }
}
```

**Without an agent.** `pnpm mcp:demo` starts the server, lists its tools, runs the tests and reads the report back, the same calls an agent makes:

```bash
pnpm --filter demo-form serve
pnpm mcp:demo http://127.0.0.1:4173 apps/demo-form
```

## Budgets, boundaries and keys

- Each agent check runs in its own browser context with tracing on.
- Navigation is limited to the preview's origin, plus any `--allow-origin`.
- Limits per check: `--max-steps` (15), `--max-tokens` (200,000) and `--check-timeout` (120 seconds). Hitting one is blocked, with the reason.
- Keys come from the environment or the OS keychain. The MCP server never accepts a key as an argument.
- `verify` sends page content to the model provider, so I run it on seeded synthetic data.

## Problems I hit, and the fixes

**Parallel tool calls raced.** Models sometimes call several tools at once. Two `fill` calls typed into the same field at the same time and produced garbage. Every browser action now goes through a promise queue:

```ts
private exclusive<A>(action: () => Promise<A>): Promise<A> {
  const next = this.queue.then(action, action);
  this.queue = next.catch(() => undefined);
  return next;
}
```

Each action waits for the previous one, even if it failed, and a failure doesn't poison the queue for the next action.

**Passes with no real proof.** A model passed a check by asserting a label that had been on the page from the start. That led to the untouched second context and the `trueAtStart` rule.

**Infrastructure failures looked like app bugs.** With the preview down, every test "failed". The probe and the classification fixed it: only an unreachable preview origin counts as blocked, and a dead third-party API stays a real failure.

**Cleanup was too greedy.** An early version closed every Playwright browser on the machine, including ones it hadn't started. Cleanup is now scoped to what the process created.

**Agents didn't find the tool.** One agent went looking for a "katalepsis skill" because the instructions didn't say what Katalepsis was. The docs now say plainly that it is a CLI and an MCP server.

## How I built it

In milestones, each with a demo target in `apps/demo-form` and its own tests. After each milestone, a fresh review agent with no history read the code. Those reviews found real issues:

- only an unreachable preview counts as blocked;
- the stricter pass rule;
- cleanup on cancellation;
- a symlink safety fix in the report tool.

Architecture decisions are written up as ADRs in the repo: result authority and the report schema, how agent checks are decided, and the MCP server.

## How I use it

Every UI change I hand off gets a `katalepsis run` against the preview, and the Markdown report goes into the pull request. For behaviour without tests, I write a short `checks.json` and run `verify` on synthetic data.

```bash
curl -fsSL https://katalepsis.glamboyosa.xyz/install.sh | sh
katalepsis auth set openrouter
katalepsis run    --cwd apps/demo-form --url http://127.0.0.1:4173
katalepsis verify --cwd apps/demo-form --url http://127.0.0.1:4173 --checks checks.json
codex mcp add katalepsis -- katalepsis-mcp --root /path/to/your-app
```

## Limits and what's next

- **Not on npm yet.** The installer clones the repo and builds it.
- **The preview commit can be unknown** when the host exposes nothing and no `--preview-commit` is passed.
- **Coverage gaps:** field values, persistence after reload, console and network errors, and layout across viewports. For those, plain browser automation still fills in.
- **`verify` depends on the model and its budget,** so some checks end blocked. I accept that trade: a blocked result says exactly what wasn't proven.
- **No ready-made CI action yet.** `run` and `verify` work in a CI job that uploads the report folder.

## Questions I expect, with answers

**Why not ask the model whether the page looks right?**
A model's description is an opinion. Assertions run in the browser, produce screenshots, and get IDs. The verdict has to cite them, and a deterministic function checks the citation.

**How do you stop false passes?**
Every cited assertion ran and passed, nothing failed after them, at least one is a visible assertion, and something changed compared with an untouched copy of the page.

**Why is "blocked" its own outcome?**
It separates "the app is broken" from "we couldn't check". Without it, a dead preview reads as an app bug, and a confident model with no evidence reads as a pass.

**Why keep Playwright as the judge in `run`?**
Teams already trust their Playwright assertions. Katalepsis adds the preview probe, classification and a report a reviewer can open. Reinterpreting assertions would make the results harder to trust.

**Why Effect?**
Typed errors and scoped resources. Probing a preview, spawning Playwright and running a model loop all fail in different ways, and Ctrl-C must clean up exactly what this run started.

**What about flaky tests?**
Playwright's flaky flag is kept and every attempt is listed. Katalepsis reports flakiness and never hides it.

**What does it cost to run?**
`run` costs nothing beyond the tests. `verify` is bounded per check by steps, tokens and a timeout, and you choose the model.

**Why does the MCP server expose whole verifications and keep the browser to itself?**
Raw browser tools would let an agent decide for itself what counts as proof. With three high-level tools, every result goes through the same evidence rules as the CLI, and the server can enforce its boundaries: one run at a time, the root folder, no keys as arguments.

**What stops an agent from passing an API key or escaping the project through MCP?**
Tool inputs reject unknown keys, so a stray `apiKey` field fails validation instead of being ignored. Every `cwd` is resolved with `realpath` and refused if it lands outside the root, so symlinks can't escape.

**How would you put it in CI?**
A job that runs `katalepsis run` or `verify` against the preview URL, uploads `artifacts/katalepsis/`, and uses the exit code to fail the job. Keys come from CI secrets as environment variables.

**What would you build next?**
Publishing to npm, then field values and persistence, console and network checks, and layout across viewports.
