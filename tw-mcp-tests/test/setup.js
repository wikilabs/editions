/*
Shared bootstrap helper for tw-mcp handler tests.

bootTw() boots a minimal TiddlyWiki instance using this edition's
tiddlywiki.info. The boot is async; await it once at the top of each test
file (typically via a node:test `before(...)` hook). Each test file gets its
own $tw — no cross-file state.

The booted $tw exposes the tw-mcp plugin via $tw.modules. Load a handler's
exports with loadHandler($tw, title); a thin wrapper around $tw.modules.execute.

Path resolution:
  - TW core boot.js: TW_CORE_PATH env var, else sibling-of-node fallback
    (covers `npm i -g tiddlywiki`).
  - tw-mcp plugin folder: $tw.findLibraryItem after boot, so the existing
    TIDDLYWIKI_PLUGIN_PATH is honoured automatically.
*/

"use strict";

const path = require("path");
const fs = require("fs");
const url = require("node:url");

const EDITION_PATH = path.resolve(__dirname, "..");
const PLUGIN_NAME = "wikilabs/tw-mcp";
const HANDLER_TITLE_PREFIX = "$:/core/modules/commands/inspect/";

// Locate tiddlywiki/boot/boot.js. First hit wins:
//   1. TW_CORE_PATH env var. Accepts either the full path to boot.js or the
//      TW5 root folder.
//   2. Sibling of `node.exe`: <node-dir>/node_modules/tiddlywiki/boot/boot.js.
//      This is where `npm install -g tiddlywiki` puts it (often via symlink
//      to a local checkout, which is how this user's machine is set up).
function findTwBoot() {
	if(process.env.TW_CORE_PATH) {
		const p = process.env.TW_CORE_PATH;
		const candidates = p.endsWith("boot.js") ? [p] : [path.join(p, "boot", "boot.js")];
		for(const c of candidates) {
			if(fs.existsSync(c)) return c;
		}
		throw new Error("TW_CORE_PATH set to " + p + " but boot.js not found there.");
	}
	const beside = path.join(path.dirname(process.execPath), "node_modules", "tiddlywiki", "boot", "boot.js");
	if(fs.existsSync(beside)) return beside;
	throw new Error(
		"Could not locate tiddlywiki/boot/boot.js. Set TW_CORE_PATH=<TW5 root> " +
		"or install tiddlywiki globally (npm install -g tiddlywiki, or symlink it)."
	);
}

const TW_BOOT_PATH = findTwBoot();

function bootTw() {
	const $tw = require(TW_BOOT_PATH).TiddlyWiki();
	$tw.boot.argv = [EDITION_PATH];
	return new Promise((resolve, reject) => {
		try {
			$tw.boot.boot(() => {
				// Use TW's own resolver so we honour TIDDLYWIKI_PLUGIN_PATH the
				// same way the running server does.
				const searchPaths = $tw.getLibraryItemSearchPaths(
					$tw.config.pluginsPath,
					$tw.config.pluginsEnvVar
				);
				const pluginFolder = $tw.findLibraryItem(PLUGIN_NAME, searchPaths);
				if(!pluginFolder) {
					return reject(new Error("Could not locate plugin folder for " + PLUGIN_NAME));
				}
				installCoveragePatches($tw, path.join(pluginFolder, "tiddlers"));
				// Initialise the handlers/shared.js module-level state. Production
				// wires this through mcp-handlers.js at MCP startup; tests need to
				// supply a permissive context so writes (which call checkPathAllowed)
				// don't fail with "checkPathAllowed is not a function".
				const shared = $tw.modules.execute(
					"$:/core/modules/commands/inspect/handlers/shared.js"
				);
				shared.init({
					readonlyMode: false,
					checkPathAllowed: function() { return null; }
				});
				resolve($tw);
			});
		} catch(e) {
			reject(e);
		}
	});
}

// Make tw-mcp handler modules visible to V8's coverage instrumentation.
// Two issues to fix:
//   1. TW evaluates modules inside a separate vm.createContext, which V8
//      coverage cannot see across. Dropping $tw.utils.sandbox falls back to
//      vm.runInThisContext (same V8 context, coverage tracks it).
//   2. The module's reported filename is its TW title ($:/core/...), but
//      node:test's coverage reporter only displays entries whose filename is
//      a file:// URL. Rewrite handler titles to their real on-disk path.
// Both patches are test-only; never apply them in production.
function installCoveragePatches($tw, pluginTiddlersDir) {
	$tw.utils.sandbox = null;
	const origEval = $tw.utils.evalSandboxed;
	$tw.utils.evalSandboxed = function(code, context, filename, allowGlobals) {
		let effective = filename;
		if(typeof filename === "string" && filename.indexOf(HANDLER_TITLE_PREFIX) === 0) {
			const rel = filename.slice(HANDLER_TITLE_PREFIX.length);
			effective = url.pathToFileURL(path.join(pluginTiddlersDir, rel)).href;
		}
		return origEval(code, context, effective, allowGlobals);
	};
}

function loadHandler($tw, title) {
	const mod = $tw.modules.execute(title);
	if(!mod || typeof mod !== "object") {
		throw new Error("Handler module did not export an object: " + title);
	}
	return mod;
}

// Test helper: remove a tiddler from both the wiki store and the on-disk
// .tid file (if any). Used by write-tests to clean up probe tiddlers in a
// try/finally so test failures do not leave junk for the next run.
function cleanupTiddler($tw, title) {
	const fi = $tw.boot.files && $tw.boot.files[title];
	if(fi && fi.filepath) {
		try { require("fs").unlinkSync(fi.filepath); } catch(e) {}
		try { require("fs").unlinkSync(fi.filepath + ".meta"); } catch(e) {}
	}
	if($tw.boot.files) delete $tw.boot.files[title];
	$tw.wiki.deleteTiddler(title);
}

module.exports = { bootTw, loadHandler, cleanupTiddler };
