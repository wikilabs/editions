"use strict";

/*
Pins test scaffolding (bead tw-mcp-server-v9m): a test file that writes tiddler
files boots its own copy of the edition, since node --test boots the other test
files from the edition's folder at the same time.

By hand: in a test file, const $tw = await bootTw({ ownFolder: true });
$tw.boot.wikiPath  // -> <os temp>/tw-mcp-tests-XXXXXX, gone once the process exits
*/

const { test, before } = require("node:test");
const assert = require("node:assert");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const { bootTw, loadHandler, cleanupTiddler } = require("./setup");

const SHARED_TIDDLERS = path.resolve(__dirname, "..", "tiddlers");
const PUT_HANDLER = "$:/core/modules/commands/inspect/handlers/crud/put_tiddler.js";
const PROBE = "setup_probe_own_folder";

let $tw;

before(async () => {
	$tw = await bootTw({ ownFolder: true });
});

test("an own folder holds a copy of the edition's tiddler files", () => {
	const own = path.join($tw.boot.wikiPath, "tiddlers");
	assert.notEqual(path.resolve(own), SHARED_TIDDLERS);
	assert.deepEqual(fs.readdirSync(own, { recursive: true }).sort(), fs.readdirSync(SHARED_TIDDLERS, { recursive: true }).sort());
});

test("a tiddler file written by a handler lands in the own folder, not in the shared one", () => {
	try {
		loadHandler($tw, PUT_HANDLER).put_tiddler({ title: PROBE, fields: { text: "probe" } });
		const filepath = $tw.boot.files[PROBE].filepath;
		assert.ok(filepath.startsWith(path.resolve($tw.boot.wikiPath)), filepath);
		assert.equal(fs.readdirSync(SHARED_TIDDLERS).some((name) => name.startsWith(PROBE)), false);
	} finally {
		cleanupTiddler($tw, PROBE);
	}
});

test("the own folder is removed when the process exits", () => {
	const script = "require(" + JSON.stringify(path.join(__dirname, "setup.js")) + ").bootTw({ ownFolder: true }).then(($tw) => console.log($tw.boot.wikiPath));",
		wikiPath = childProcess.execFileSync(process.execPath, ["-e", script], { encoding: "utf8" }).trim();
	assert.ok(wikiPath.length > 0);
	assert.equal(fs.existsSync(wikiPath), false, wikiPath);
});
