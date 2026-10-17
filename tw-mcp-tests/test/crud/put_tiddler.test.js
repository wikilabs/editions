"use strict";

const { test, before } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const { bootTw, loadHandler, cleanupTiddler } = require("../setup");

const HANDLER_TITLE = "$:/core/modules/commands/inspect/handlers/crud/put_tiddler.js";

let putTiddler;
let $tw;

before(async () => {
	$tw = await bootTw({ ownFolder: true });
	putTiddler = loadHandler($tw, HANDLER_TITLE).put_tiddler;
});

test("put_tiddler: creates new tiddler and writes a .tid file", () => {
	const title = "put_probe_new";
	try {
		const result = putTiddler({ title, fields: { text: "probe body", tags: "probe" } });
		assert.equal(result.isError, undefined);
		assert.match(result.content[0].text, /^Tiddler saved/);
		// Verify on-disk file exists.
		const fi = $tw.boot.files[title];
		assert.ok(fi && fi.filepath);
		assert.ok(fs.existsSync(fi.filepath));
		// Verify wiki store has the tiddler.
		assert.equal($tw.wiki.getTiddler(title).fields.text, "probe body");
	} finally {
		cleanupTiddler($tw, title);
	}
});

test("put_tiddler: existing title without overwrite uniquifies", () => {
	const title = "put_probe_collision";
	let uniqueTitle = null;
	try {
		putTiddler({ title, fields: { text: "first" } });
		const result = putTiddler({ title, fields: { text: "second" } });
		assert.equal(result.isError, undefined);
		// The save message reports the uniquified title; titles may contain
		// spaces (e.g. "probe 1"), so match up to the path arrow.
		const m = result.content[0].text.match(/Tiddler saved:\s+(.+?)\s+->/);
		assert.ok(m, "save message has a title");
		uniqueTitle = m[1];
		assert.notEqual(uniqueTitle, title);
		// Original tiddler still has "first" content.
		assert.equal($tw.wiki.getTiddler(title).fields.text, "first");
	} finally {
		cleanupTiddler($tw, title);
		if(uniqueTitle) cleanupTiddler($tw, uniqueTitle);
	}
});

test("put_tiddler: overwrite=true replaces existing", () => {
	const title = "put_probe_overwrite";
	try {
		putTiddler({ title, fields: { text: "first" } });
		const result = putTiddler({ title, fields: { text: "second" }, overwrite: true });
		assert.equal(result.isError, undefined);
		assert.equal($tw.wiki.getTiddler(title).fields.text, "second");
	} finally {
		cleanupTiddler($tw, title);
	}
});

// by hand: put_tiddler {title:"T", fields:{text:"a", extra:"x"}}, then {title:"T", fields:{text:"b"}, overwrite:true};
// get_tiddler T has text "b", no extra, and the first save's created
test("put_tiddler: overwrite=true drops fields the new version omits, keeps created", () => {
	const title = "put_probe_overwrite_fields";
	try {
		putTiddler({ title, fields: { text: "first", extra: "old field" } });
		const created = $tw.wiki.getTiddler(title).fields.created;
		const result = putTiddler({ title, fields: { text: "second" }, overwrite: true });
		assert.equal(result.isError, undefined);
		const fields = $tw.wiki.getTiddler(title).fields;
		assert.equal(fields.text, "second");
		assert.equal(fields.extra, undefined, "a field the new version omits is gone");
		assert.equal(String(fields.created), String(created), "created stays the first save's");
	} finally {
		cleanupTiddler($tw, title);
	}
});

test("put_tiddler: title over MAX_TITLE_LENGTH -> error", () => {
	const longTitle = "x".repeat(1025);
	const result = putTiddler({ title: longTitle, fields: { text: "body" } });
	assert.equal(result.isError, true);
	assert.match(result.content[0].text, /title too long/i);
});
