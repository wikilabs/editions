"use strict";

const { test, before } = require("node:test");
const assert = require("node:assert");
const { bootTw, loadHandler } = require("../setup");

const HANDLER_TITLE = "$:/core/modules/commands/inspect/handlers/crud/get_tiddlers.js";

let getTiddlers;
let $tw;

before(async () => {
	$tw = await bootTw();
	getTiddlers = loadHandler($tw, HANDLER_TITLE).get_tiddlers;
});

test("get_tiddlers: batch read returns CompoundTiddlers form", () => {
	const result = getTiddlers({ titles: ["get_tiddlers_a", "get_tiddlers_b"] });
	assert.equal(result.isError, undefined);
	const text = result.content[0].text;
	// Blocks separated by '\n+\n'.
	assert.match(text, /\n\+\n/);
	assert.match(text, /title: get_tiddlers_a/);
	assert.match(text, /title: get_tiddlers_b/);
});

test("get_tiddlers: missing titles surface in a trailing Missing: line", () => {
	const result = getTiddlers({ titles: ["get_tiddlers_a", "MISSING_xyz"] });
	const text = result.content[0].text;
	assert.match(text, /Missing: MISSING_xyz/);
});

test("get_tiddlers: format='json' returns {tiddlers, missing}", () => {
	const result = getTiddlers({
		titles: ["get_tiddlers_a", "get_tiddlers_b", "MISSING_xyz"],
		format: "json"
	});
	const obj = JSON.parse(result.content[0].text);
	assert.equal(obj.tiddlers.length, 2);
	assert.deepEqual(obj.missing, ["MISSING_xyz"]);
});

test("get_tiddlers: verbose=false (default) skips bookkeeping fields", () => {
	// Inject a tiddler with timestamps so the test exercises the strip
	// behaviour against a tiddler that actually has the fields.
	$tw.wiki.addTiddler({
		title: "verbose_probe",
		text: "body",
		created: new Date(2026, 4, 12, 10, 0, 0),
		modified: new Date(2026, 4, 12, 14, 32, 15)
	});
	try {
		const result = getTiddlers({ titles: ["verbose_probe"], verbose: false });
		const text = result.content[0].text;
		assert.doesNotMatch(text, /^created:/m);
		assert.doesNotMatch(text, /^modified:/m);
	} finally {
		$tw.wiki.deleteTiddler("verbose_probe");
	}
});

test("get_tiddlers: verbose=true includes bookkeeping fields", () => {
	$tw.wiki.addTiddler({
		title: "verbose_probe",
		text: "body",
		created: new Date(2026, 4, 12, 10, 0, 0),
		modified: new Date(2026, 4, 12, 14, 32, 15)
	});
	try {
		const result = getTiddlers({ titles: ["verbose_probe"], verbose: true });
		const text = result.content[0].text;
		assert.match(text, /^created:/m);
		assert.match(text, /^modified:/m);
	} finally {
		$tw.wiki.deleteTiddler("verbose_probe");
	}
});

test("get_tiddlers: verbose=true does NOT synthesise absent bookkeeping fields", () => {
	// get_tiddlers_a has no created/modified in its fixture; TW UI templates
	// commonly have neither either. verbose=true must surface what exists, not
	// fabricate missing fields.
	const result = getTiddlers({ titles: ["get_tiddlers_a"], verbose: true });
	const text = result.content[0].text;
	assert.doesNotMatch(text, /^created:/m);
	assert.doesNotMatch(text, /^modified:/m);
});

test("get_tiddlers: title-only tiddler (minimum-viable) returns clean block", () => {
	$tw.wiki.addTiddler({ title: "title_only_probe" });
	try {
		const result = getTiddlers({ titles: ["title_only_probe"] });
		const text = result.content[0].text;
		// First line is "title:", and there should be no other field lines.
		assert.match(text, /^title: title_only_probe$/m);
		assert.doesNotMatch(text, /^(created|modified|creator|modifier|type|tags):/m);
	} finally {
		$tw.wiki.deleteTiddler("title_only_probe");
	}
});

test("get_tiddlers: empty titles array -> error", () => {
	const result = getTiddlers({ titles: [] });
	assert.equal(result.isError, true);
	assert.match(result.content[0].text, /non-empty array/);
});

test("get_tiddlers: max_tiddlers cap truncates", () => {
	const result = getTiddlers({
		titles: ["get_tiddlers_a", "get_tiddlers_b"],
		max_tiddlers: 1
	});
	assert.match(result.content[0].text, /\d+ entries truncated/);
});
