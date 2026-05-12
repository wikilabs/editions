"use strict";

const { test, before } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const { bootTw, loadHandler, cleanupTiddler } = require("../setup");

const PUT_HANDLER = "$:/core/modules/commands/inspect/handlers/crud/put_tiddler.js";
const DELETE_HANDLER = "$:/core/modules/commands/inspect/handlers/crud/delete_tiddler.js";

let putTiddler, deleteTiddler;
let $tw;

before(async () => {
	$tw = await bootTw();
	putTiddler = loadHandler($tw, PUT_HANDLER).put_tiddler;
	deleteTiddler = loadHandler($tw, DELETE_HANDLER).delete_tiddler;
});

test("delete_tiddler: removes from wiki + deletes .tid file", () => {
	const title = "delete_probe";
	let filepath = null;
	try {
		putTiddler({ title, fields: { text: "body" } });
		filepath = $tw.boot.files[title].filepath;
		assert.ok(fs.existsSync(filepath));
		const result = deleteTiddler({ title });
		assert.equal(result.isError, undefined);
		assert.match(result.content[0].text, /^Tiddler deleted/);
		assert.equal($tw.wiki.tiddlerExists(title), false);
		assert.equal(fs.existsSync(filepath), false);
	} finally {
		// Belt-and-suspenders cleanup in case the assertions fail.
		cleanupTiddler($tw, title);
	}
});

test("delete_tiddler: missing tiddler -> error", () => {
	const result = deleteTiddler({ title: "DoesNotExist__xyz" });
	assert.equal(result.isError, true);
	assert.match(result.content[0].text, /not found/i);
});

test("delete_tiddler: title over MAX_TITLE_LENGTH -> error", () => {
	const result = deleteTiddler({ title: "x".repeat(1025) });
	assert.equal(result.isError, true);
	assert.match(result.content[0].text, /title too long/i);
});
