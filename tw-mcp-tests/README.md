# tw-mcp-tests

Headless test edition for the [tw-mcp](../../plugins/wikilabs/tw-mcp/) plugin. Tests use Node's built-in `node:test` runner; no extra dependencies.

## Run

From this folder:

```
node --test "test/**/*.test.js"
```

With coverage scoped to the tw-mcp handlers:

```
node --test --experimental-test-coverage --test-coverage-include="**/wikilabs/plugins/wikilabs/tw-mcp/tiddlers/handlers/**" "test/**/*.test.js"
```

Tighten the `--test-coverage-include` glob to focus on a single category, e.g. `**/handlers/render/**`.

## Layout

- `tiddlywiki.info` — minimal edition spec, loads only the `wikilabs/tw-mcp` plugin.
- `tiddlers/<category>/*.tid` — fixture tiddlers loaded into `$tw.wiki` at boot, grouped by the handler category that uses them.
- `test/setup.js` — boots TiddlyWiki once per test file, exposes the booted `$tw` and a `loadHandler` helper. Includes coverage workarounds (see below).
- `test/_smoke.test.js` — verifies the bootstrap itself.
- `test/_probe.js` — manual diagnostic script (not run by `--test` thanks to the `_` prefix). Boots TW and prints handler output for ad-hoc investigation; useful when an assertion fails and you want to see whether the code or the test is wrong.
- `test/<category>/<tool>.test.js` — one file per MCP handler tool, grouped by category. Currently covered: `render/`, `query/`, `inspect/`, `crud/`. All four batch-1 categories landed.

Tests that document a known code finding (where the assertion encodes the *desired* behaviour, not the current one) are marked `test.todo(...)` with an inline comment referencing the bead. They appear in the run output as `# TODO` but do not fail the suite — they self-resolve once the underlying code is fixed.

## Path resolution

`test/setup.js` resolves both the TiddlyWiki core and the tw-mcp plugin folder dynamically — no hardcoded paths in test code:

- **TW core**: tries `process.env.TW_CORE_PATH` (full path to `boot.js` or a TW5 root). Falls back to `<node-dir>/node_modules/tiddlywiki/boot/boot.js`, which works for a `npm install -g tiddlywiki` layout (including a symlinked global install).
- **tw-mcp plugin folder**: looked up at runtime via `$tw.findLibraryItem("wikilabs/tw-mcp", ...)` using `$tw.config.pluginsEnvVar` (i.e. `TIDDLYWIKI_PLUGIN_PATH`), which is what the production server already uses.

## Handler init for write tests

`handlers/shared.js` holds module-level state (`readonlyMode`, `checkPathAllowed`) that production wires up from `mcp-handlers.js` at MCP startup. The boot helper invokes `shared.init(...)` after boot with a permissive context (`readonlyMode: false`, `checkPathAllowed` always allows) so write handlers (`put_tiddler`, `edit_tiddler`, `delete_tiddler`, etc.) don't fail with "checkPathAllowed is not a function". Write tests use a `cleanupTiddler(...)` helper in a try/finally to remove probe tiddlers from the wiki store and on-disk `.tid` file after each test.

## Coverage workarounds

TiddlyWiki executes its modules inside `vm.createContext`, which V8's coverage instrumentation cannot see. Loaded modules also identify themselves by TW title (e.g. `$:/core/...`), not a `file://` URL — Node's coverage reporter filters non-`file://` entries.

`test/setup.js` works around both:

1. After boot, sets `$tw.utils.sandbox = null` so further module executions fall through to `vm.runInThisContext` (same V8 context, coverage tracks them).
2. Wraps `$tw.utils.evalSandboxed` to translate any title prefixed `$:/core/modules/commands/inspect/` to the matching on-disk `file://` URL inside the tw-mcp plugin's `tiddlers/` tree.

The workaround is scoped to the tw-mcp plugin's handler tree. Other plugins' modules will not show up in coverage reports without extending the URL mapping.
