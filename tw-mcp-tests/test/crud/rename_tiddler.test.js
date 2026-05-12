"use strict";

const { test, before } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const { bootTw, loadHandler, cleanupTiddler } = require("../setup");

const PUT_HANDLER = "$:/core/modules/commands/inspect/handlers/crud/put_tiddler.js";
const RENAME_HANDLER = "$:/core/modules/commands/inspect/handlers/crud/rename_tiddler.js";

let putTiddler, renameTiddler;
let $tw;

before(async () => {
	$tw = await bootTw();
	putTiddler = loadHandler($tw, PUT_HANDLER).put_tiddler;
	renameTiddler = loadHandler($tw, RENAME_HANDLER).rename_tiddler;
});

test("rename_tiddler: moves wiki entry + .tid file", () => {
	const from = "rename_probe_from";
	const to = "rename_probe_to";
	try {
		putTiddler({ title: from, fields: { text: "body" } });
		const oldPath = $tw.boot.files[from] && $tw.boot.files[from].filepath;
		const result = renameTiddler({ from, to });
		assert.equal(result.isError, undefined);
		assert.equal($tw.wiki.tiddlerExists(from), false);
		assert.equal($tw.wiki.getTiddler(to).fields.text, "body");
		// Old file removed.
		assert.equal(fs.existsSync(oldPath), false);
	} finally {
		cleanupTiddler($tw, from);
		cleanupTiddler($tw, to);
	}
});

test("rename_tiddler: from === to -> error", () => {
	const result = renameTiddler({ from: "X", to: "X" });
	assert.equal(result.isError, true);
	assert.match(result.content[0].text, /identical/);
});

test("rename_tiddler: missing source -> error", () => {
	const result = renameTiddler({ from: "DoesNotExist__xyz", to: "anywhere" });
	assert.equal(result.isError, true);
	assert.match(result.content[0].text, /not found/i);
});

test("rename_tiddler: existing target without overwrite -> error", () => {
	const from = "rename_probe_src";
	const to = "rename_probe_dst";
	try {
		putTiddler({ title: from, fields: { text: "src" } });
		putTiddler({ title: to, fields: { text: "dst" } });
		const result = renameTiddler({ from, to });
		assert.equal(result.isError, true);
		assert.match(result.content[0].text, /already exists/);
	} finally {
		cleanupTiddler($tw, from);
		cleanupTiddler($tw, to);
	}
});
