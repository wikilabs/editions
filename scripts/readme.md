# editions/scripts

Shared tooling for the wikilabs editions. Every `<edition>-server` directory is
a sibling of this one, so all of them reach it as `../scripts/…`.

## tw.js

Boots a chosen TiddlyWiki core, so pages are always built with a known version.

### Why it exists

The global `tiddlywiki` command is not an installed copy of TiddlyWiki. It is a
junction into the TW5 **working copy**:

```
C:\Users\…\node_modules\tiddlywiki  ->  E:\git\tiddly\tiddlywiki\TiddlyWiki5
```

So `tiddlywiki --build` used whatever happened to be checked out there at that
moment, including a prerelease, another branch, or uncommitted edits. Builds
were not reproducible and nothing recorded which core produced them.

### Usage

```
node ../scripts/tw.js [--core <name|path>] <tiddlywiki arguments…>
```

Everything after the `--core` pair is handed to TiddlyWiki untouched, so any
existing command becomes a wrapped one by replacing the leading `tiddlywiki`:

```
tiddlywiki ../my-edition --build github
node ../scripts/tw.js --core release ../my-edition --build github
```

### Which core is used

Highest precedence first:

1. the `TW_CORE` environment variable — a name or a path
2. `--core <name|path>` — what the npm script asks for
3. `"default"` in `tw-cores.json`

The environment variable outranks the script on purpose. When a release tag is
broken, publish from another core without editing anything:

```powershell
$env:TW_CORE="dev"; npm run stage
```

Every run prints one line to stderr, so build logs record what was used:

```
[tw] core=release v5.4.1 E:\git\tiddly\tiddlywiki\TiddlyWiki5.worktrees\release
```

### tw-cores.json

The only file holding paths. They are resolved relative to this directory, so
the answer does not depend on which edition invoked the script.

```json
{
	"default": "release",
	"cores": {
		"release": "../../../tiddlywiki/TiddlyWiki5.worktrees/release",
		"dev": "../../../tiddlywiki/TiddlyWiki5"
	}
}
```

- `release` — a git worktree pinned to a TiddlyWiki release tag. Used for
  everything that builds or stages.
- `dev` — the TW5 working copy, the same code the global command points at.
  Used by the dev servers, so development is unaffected.

### First-time setup

`release` does not exist until the worktree is created. From the TW5 repo:

```powershell
git worktree add --detach ..\TiddlyWiki5.worktrees\release v5.4.1
```

`--detach` is deliberate: with no branch the worktree cannot be committed to or
moved, so the pin cannot drift. The cost is that editors which list worktrees by
branch will not show it.

No `npm install` is involved anywhere. `tw.js` requires the core's `boot.js`
directly, so nothing is downloaded and no `node_modules` appears in an edition.

### Moving to a new TiddlyWiki release

One place, and every edition follows:

```powershell
git -C ..\..\..\tiddlywiki\TiddlyWiki5.worktrees\release fetch --tags
git -C ..\..\..\tiddlywiki\TiddlyWiki5.worktrees\release checkout v5.4.2
```

### Convention in package.json

- scripts that run a server (`start`, anything with `--listen` or `--mcp`)
  use `--core dev`
- scripts that build or stage use `--core release`

### Why the core is booted in-process

`tw.js` requires the core rather than spawning a child process, which keeps two
things exactly as the caller had them:

- **stdin** — the dev server's tw-mcp shuts down the moment its stdin closes, so
  a wrapper that did not pass stdin through would break `npm start`.
- **the working directory** — build targets resolve `--output` and `--load`
  against the calling `-server` directory. That is why a build must be started
  through npm from its own `-server` folder and never as a direct `tiddlywiki`
  call against the wiki folder.

### Checking a published page

The `[tw]` line says which core **booted**. To confirm which core **rendered**
something already published, read the version out of the built HTML:

```powershell
Select-String -Path ..\..\wikilabs.github.io\editions\<name>\index.html `
	-Pattern '"version":"5\.[^"]+"' | Select-Object -First 1
```
