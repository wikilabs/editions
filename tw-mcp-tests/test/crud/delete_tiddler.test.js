"use strict";

const { test, before } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const { bootTw, loadHandler, cleanupTiddler, waitForGone } = require("../setup");

const PUT_HANDLER = "$:/core/modules/commands/inspect/handlers/crud/put_tiddler.js";
const DELETE_HANDLER = "$:/core/modules/commands/inspect/handlers/crud/delete_tiddler.js";

let putTiddler, deleteTiddler;
let $tw;

before(async () => {
	$tw = await bootTw({ ownFolder: true });
	putTiddler = loadHandler($tw, PUT_HANDLER).put_tiddler;
	deleteTiddler = loadHandler($tw, DELETE_HANDLER).delete_tiddler;
});

test("delete_tiddler: removes from wiki + deletes .tid file", async () => {
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
		// File removed — eventually: the handler's unlink is async
		// best-effort by design, so poll instead of racing it.
		assert.equal(await waitForGone(filepath), true);
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

// A core shadow tiddler, present in every wiki.
const SHADOW_TITLE = "$:/core/ui/Buttons/close";

test("delete_tiddler: a shadow-only title is refused as not found and stays", () => {
	const result = deleteTiddler({ title: SHADOW_TITLE });
	assert.equal(result.isError, true);
	assert.match(result.content[0].text, /not found/i);
	assert.equal($tw.wiki.isShadowTiddler(SHADOW_TITLE), true);
});

test("delete_tiddler: deleting an overridden shadow brings the plugin's version back", () => {
	const shadowText = $tw.wiki.getTiddlerText(SHADOW_TITLE);
	try {
		putTiddler({ title: SHADOW_TITLE, fields: { text: "overridden" }, overwrite: true });
		assert.equal($tw.wiki.getTiddlerText(SHADOW_TITLE), "overridden");
		const result = deleteTiddler({ title: SHADOW_TITLE });
		assert.equal(result.isError, undefined);
		assert.equal($tw.wiki.getTiddlerText(SHADOW_TITLE), shadowText);
	} finally {
		cleanupTiddler($tw, SHADOW_TITLE);
	}
});

test("delete_tiddler: title over MAX_TITLE_LENGTH -> error", () => {
	const result = deleteTiddler({ title: "x".repeat(1025) });
	assert.equal(result.isError, true);
	assert.match(result.content[0].text, /title too long/i);
});
