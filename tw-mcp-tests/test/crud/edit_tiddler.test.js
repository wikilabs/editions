"use strict";

const { test, before } = require("node:test");
const assert = require("node:assert");
const { bootTw, loadHandler, cleanupTiddler } = require("../setup");

const PUT_HANDLER = "$:/core/modules/commands/inspect/handlers/crud/put_tiddler.js";
const EDIT_HANDLER = "$:/core/modules/commands/inspect/handlers/crud/edit_tiddler.js";
const GET_HANDLER = "$:/core/modules/commands/inspect/handlers/crud/get_tiddler.js";

let putTiddler, editTiddler, getTiddler;
let $tw;

before(async () => {
	$tw = await bootTw();
	putTiddler = loadHandler($tw, PUT_HANDLER).put_tiddler;
	editTiddler = loadHandler($tw, EDIT_HANDLER).edit_tiddler;
	getTiddler = loadHandler($tw, GET_HANDLER).get_tiddler;
});

function probeAnchor(title) {
	// Read the first line's hashline anchor (e.g. "1#AB").
	const text = getTiddler({ title, detailed: true }).content[0].text;
	const m = text.match(/(\d+)#([A-Z]+):/);
	return m ? m[0].replace(/:$/, "") : null;
}

test("edit_tiddler: replace_line via hashline anchor rewrites body", () => {
	const title = "edit_probe_replace_line";
	try {
		putTiddler({ title, fields: { text: "line one\nline two\nline three" } });
		const anchor = probeAnchor(title);
		const result = editTiddler({
			title,
			edits: [{ op: "replace_line", pos: anchor, lines: ["LINE ONE EDITED"] }]
		});
		assert.equal(result.isError, undefined);
		assert.match($tw.wiki.getTiddler(title).fields.text, /^LINE ONE EDITED/);
	} finally {
		cleanupTiddler($tw, title);
	}
});

test("edit_tiddler: set_fields adds non-text fields", () => {
	const title = "edit_probe_set_fields";
	try {
		putTiddler({ title, fields: { text: "body" } });
		const result = editTiddler({
			title,
			set_fields: { caption: "My Caption", color: "red" }
		});
		assert.equal(result.isError, undefined);
		const t = $tw.wiki.getTiddler(title);
		assert.equal(t.fields.caption, "My Caption");
		assert.equal(t.fields.color, "red");
	} finally {
		cleanupTiddler($tw, title);
	}
});

test("edit_tiddler: delete_fields drops named fields", () => {
	const title = "edit_probe_delete_fields";
	try {
		putTiddler({ title, fields: { text: "body", color: "red", style: "italic" } });
		const result = editTiddler({
			title,
			delete_fields: ["color"]
		});
		assert.equal(result.isError, undefined);
		const t = $tw.wiki.getTiddler(title);
		assert.equal(t.fields.color, undefined);
		assert.equal(t.fields.style, "italic");
	} finally {
		cleanupTiddler($tw, title);
	}
});

test("edit_tiddler: stale hashline anchor -> HashlineMismatchError surfaced", () => {
	const title = "edit_probe_stale_anchor";
	try {
		putTiddler({ title, fields: { text: "line one\nline two" } });
		// Made-up anchor that won't match any line hash.
		const result = editTiddler({
			title,
			edits: [{ op: "replace_line", pos: "1#ZZ", lines: ["x"] }]
		});
		assert.equal(result.isError, true);
		// HashlineMismatchError message lists fresh LINE#ID anchors for retry.
		assert.match(result.content[0].text, /LINE#ID|changed since last read/i);
	} finally {
		cleanupTiddler($tw, title);
	}
});

test("edit_tiddler: missing tiddler -> error", () => {
	const result = editTiddler({ title: "DoesNotExist__xyz", set_fields: { color: "red" } });
	assert.equal(result.isError, true);
	assert.match(result.content[0].text, /not found/i);
});
