"use strict";

const { test, before } = require("node:test");
const assert = require("node:assert");
const { bootTw, loadHandler } = require("../setup");

const HANDLER_TITLE = "$:/core/modules/commands/inspect/handlers/crud/resave_tiddler.js";

let resaveTiddler;
let $tw;

before(async () => {
	$tw = await bootTw();
	resaveTiddler = loadHandler($tw, HANDLER_TITLE).resave_tiddler;
});

test("resave_tiddler: dry_run reports old/new paths without writing", () => {
	const result = resaveTiddler({ title: "resave_tiddler_target", dry_run: true });
	assert.equal(result.isError, undefined);
	const text = result.content[0].text;
	assert.match(text, /^DRY RUN resave_tiddler: resave_tiddler_target/);
	assert.match(text, /^old:\s+/m);
	assert.match(text, /^new:\s+/m);
	assert.match(text, /relocated: (true|false)/);
});

test("resave_tiddler: dry_run reports stripped redundant fields", () => {
	// resave_tiddler_target has revision: 42 + type: text/vnd.tiddlywiki — both
	// stripped by default (strip_redundant=true).
	const result = resaveTiddler({ title: "resave_tiddler_target", dry_run: true });
	assert.match(result.content[0].text, /fields_stripped: revision/);
	assert.match(result.content[0].text, /fields_stripped:.*type/);
});

test("resave_tiddler: missing tiddler -> error", () => {
	const result = resaveTiddler({ title: "DoesNotExist__xyz", dry_run: true });
	assert.equal(result.isError, true);
	assert.match(result.content[0].text, /not found/i);
});

test("resave_tiddler: shadow-only tiddler refuses (no file on disk)", () => {
	// $:/SiteTitle is a shadow tiddler in the test edition — has no on-disk file.
	const result = resaveTiddler({ title: "$:/SiteTitle", dry_run: true });
	assert.equal(result.isError, true);
	assert.match(result.content[0].text, /no file on disk/);
});

test("resave_tiddler: bundled plugin tiddler refuses", () => {
	// Subtiddlers of plugins are bundled — checkNotBundled rejects them.
	const result = resaveTiddler({
		title: "$:/core/modules/commands/inspect/handlers/shared.js",
		dry_run: true
	});
	assert.equal(result.isError, true);
});
