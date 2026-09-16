/*
Boots this edition for handler tests: await bootTw() once per test file, then
loadHandler($tw, title) returns a module's exports.
*/

"use strict";

const path = require("path");
const fs = require("fs");
const os = require("os");
const url = require("node:url");

const EDITION_PATH = path.resolve(__dirname, "..");
// Since the 0.14.0 split the handlers live in tw-mcp-core; the server
// plugin keeps the node-only tools. Coverage resolves titles against both.
const PLUGIN_NAMES = ["wikilabs/tw-mcp-core", "wikilabs/tw-mcp"];
const HANDLER_TITLE_PREFIX = "$:/core/modules/commands/inspect/";

// boot.js from TW_CORE_PATH (the file or the TW5 root), else beside node.exe, where npm install -g tiddlywiki puts it.
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

// options.ownFolder boots a copy of the edition, for a test file that writes tiddler files while
// other test files boot this folder in parallel (bead tw-mcp-server-v9m).
function bootTw(options) {
	const wikiPath = options && options.ownFolder ? copyEdition() : EDITION_PATH;
	const $tw = require(TW_BOOT_PATH).TiddlyWiki();
	$tw.boot.argv = [wikiPath];
	return new Promise((resolve, reject) => {
		try {
			$tw.boot.boot(() => {
				// TW's own resolver honours TIDDLYWIKI_PLUGIN_PATH as the running server does.
				const searchPaths = $tw.getLibraryItemSearchPaths(
					$tw.config.pluginsPath,
					$tw.config.pluginsEnvVar
				);
				const tiddlersDirs = [];
				for(const name of PLUGIN_NAMES) {
					const pluginFolder = $tw.findLibraryItem(name, searchPaths);
					if(!pluginFolder) {
						return reject(new Error("Could not locate plugin folder for " + name));
					}
					tiddlersDirs.push(path.join(pluginFolder, "tiddlers"));
				}
				installCoveragePatches($tw, tiddlersDirs);
				// MCP startup initialises shared.js in production; a permissive checkPathAllowed lets tests write.
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

// The edition's tiddlywiki.info and tiddlers in a temporary folder, removed when the process exits.
function copyEdition() {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tw-mcp-tests-"));
	fs.copyFileSync(path.join(EDITION_PATH, "tiddlywiki.info"), path.join(dir, "tiddlywiki.info"));
	fs.cpSync(path.join(EDITION_PATH, "tiddlers"), path.join(dir, "tiddlers"), { recursive: true });
	process.on("exit", () => {
		// Best-effort teardown: a folder left in the temp directory harms nothing.
		try {
			fs.rmSync(dir, { recursive: true, force: true });
		} catch(err) {}
	});
	return dir;
}

// Test-only: V8 coverage sees modules evaluated in this context, reported under their file:// path rather than their title.
function installCoveragePatches($tw, pluginTiddlersDirs) {
	$tw.utils.sandbox = null;
	const origEval = $tw.utils.evalSandboxed;
	$tw.utils.evalSandboxed = function(code, context, filename, allowGlobals) {
		let effective = filename;
		if(typeof filename === "string" && filename.indexOf(HANDLER_TITLE_PREFIX) === 0) {
			const rel = filename.slice(HANDLER_TITLE_PREFIX.length);
			for(const dir of pluginTiddlersDirs) {
				const candidate = path.join(dir, rel);
				if(fs.existsSync(candidate)) {
					effective = url.pathToFileURL(candidate).href;
					break;
				}
			}
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

// Removes a probe tiddler from the wiki and its .tid file from disk; best-effort, for a test's finally.
function cleanupTiddler($tw, title) {
	const fi = $tw.boot.files && $tw.boot.files[title];
	if(fi && fi.filepath) {
		try { require("fs").unlinkSync(fi.filepath); } catch(e) {}
		try { require("fs").unlinkSync(fi.filepath + ".meta"); } catch(e) {}
	}
	if($tw.boot.files) delete $tw.boot.files[title];
	$tw.wiki.deleteTiddler(title);
}

// Waits up to timeoutMs for filepath to disappear, since delete and rename unlink asynchronously; true when gone.
async function waitForGone(filepath, timeoutMs) {
	const deadline = Date.now() + (timeoutMs || 2000);
	while(fs.existsSync(filepath)) {
		if(Date.now() > deadline) return false;
		await new Promise((r) => setTimeout(r, 25));
	}
	return true;
}

module.exports = { bootTw, loadHandler, cleanupTiddler, waitForGone };
