"use strict";

const { test, before } = require("node:test");
const assert = require("node:assert");
const { bootTw, loadHandler, cleanupTiddler } = require("../setup");

const PUT_HANDLER = "$:/core/modules/commands/inspect/handlers/crud/put_tiddler.js";
const REPLACE_HANDLER = "$:/core/modules/commands/inspect/handlers/crud/replace_in_tiddlers.js";

let putTiddler, replaceInTiddlers;
let $tw;

before(async () => {
	$tw = await bootTw();
	putTiddler = loadHandler($tw, PUT_HANDLER).put_tiddler;
	replaceInTiddlers = loadHandler($tw, REPLACE_HANDLER).replace_in_tiddlers;
});

const PROBE_TITLE = "replace_probe";
const PROBE_TITLE_2 = "replace_probe_2";

function seed() {
	putTiddler({ title: PROBE_TITLE, fields: { text: "alpha one\nbeta two\nalpha three" } });
	putTiddler({ title: PROBE_TITLE_2, fields: { text: "alpha solo" } });
}

function cleanup() {
	cleanupTiddler($tw, PROBE_TITLE);
	cleanupTiddler($tw, PROBE_TITLE_2);
}

test("replace_in_tiddlers: dry_run shows per-line - before / + after diff", () => {
	seed();
	try {
		const result = replaceInTiddlers({
			rules: [{ pattern: "alpha", replacement: "ALPHA" }],
			filter: "[prefix[replace_probe]]"
		});
		assert.equal(result.isError, undefined);
		const text = result.content[0].text;
		assert.match(text, /DRY RUN: 3 replacements across 2 tiddlers/);
		assert.match(text, /- .*alpha one/);
		assert.match(text, /\+ .*ALPHA one/);
		// Wiki state unchanged since this was a dry run.
		assert.match($tw.wiki.getTiddler(PROBE_TITLE).fields.text, /^alpha one/);
	} finally {
		cleanup();
	}
});

test("replace_in_tiddlers: dry_run=false applies replacements to wiki + disk", () => {
	seed();
	try {
		const result = replaceInTiddlers({
			rules: [{ pattern: "alpha", replacement: "ALPHA" }],
			filter: "[prefix[replace_probe]]",
			dry_run: false
		});
		assert.equal(result.isError, undefined);
		assert.match(result.content[0].text, /2 tiddlers modified, 3 replacements/);
		assert.match($tw.wiki.getTiddler(PROBE_TITLE).fields.text, /^ALPHA one/);
	} finally {
		cleanup();
	}
});

test("replace_in_tiddlers: regexp flag enables JS backrefs", () => {
	seed();
	try {
		const result = replaceInTiddlers({
			rules: [{ pattern: "(alpha) (\\w+)", replacement: "$2-$1", regexp: true }],
			filter: "[[" + PROBE_TITLE + "]]"
		});
		assert.match(result.content[0].text, /one-alpha/);
	} finally {
		cleanup();
	}
});

test("replace_in_tiddlers: empty rules array -> error", () => {
	const result = replaceInTiddlers({ rules: [] });
	assert.equal(result.isError, true);
	assert.match(result.content[0].text, /non-empty array/);
});

test("replace_in_tiddlers: no matches returns '(no matches)'", () => {
	seed();
	try {
		const result = replaceInTiddlers({
			rules: [{ pattern: "no_such_word_xyz", replacement: "irrelevant" }],
			filter: "[prefix[replace_probe]]"
		});
		assert.equal(result.content[0].text, "(no matches)");
	} finally {
		cleanup();
	}
});

test("replace_in_tiddlers: rule with non-string replacement -> error", () => {
	const result = replaceInTiddlers({
		rules: [{ pattern: "x", replacement: 42 }]
	});
	assert.equal(result.isError, true);
	assert.match(result.content[0].text, /'replacement' must be a string/);
});
