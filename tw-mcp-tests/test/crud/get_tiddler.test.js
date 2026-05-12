"use strict";

const { test, before } = require("node:test");
const assert = require("node:assert");
const { bootTw, loadHandler } = require("../setup");

const HANDLER_TITLE = "$:/core/modules/commands/inspect/handlers/crud/get_tiddler.js";

let getTiddler;
let $tw;

before(async () => {
	$tw = await bootTw();
	getTiddler = loadHandler($tw, HANDLER_TITLE).get_tiddler;
});

test("get_tiddler: default (no detailed) returns metadata, no body", () => {
	const result = getTiddler({ title: "get_tiddler_simple" });
	assert.equal(result.isError, undefined);
	const text = result.content[0].text;
	assert.match(text, /^title: get_tiddler_simple/m);
	assert.match(text, /tags: crud_read/);
	assert.doesNotMatch(text, /line one/);
});

test("get_tiddler: detailed=true appends hashlined body", () => {
	const result = getTiddler({ title: "get_tiddler_simple", detailed: true });
	assert.equal(result.isError, undefined);
	const text = result.content[0].text;
	assert.match(text, /\d+#[A-Z]+:\s*line one/);
});

test("get_tiddler: format='tid' returns plain body", () => {
	const result = getTiddler({ title: "get_tiddler_simple", detailed: true, format: "tid" });
	const text = result.content[0].text;
	assert.match(text, /^title: get_tiddler_simple/m);
	// 'tid' format has no hash anchors; plain newlines for body.
	assert.match(text, /\nline one\n/);
	assert.doesNotMatch(text, /#[A-Z]+:/);
});

test("get_tiddler: format='json' returns parseable JSON with title first", () => {
	const result = getTiddler({ title: "get_tiddler_simple", detailed: true, format: "json" });
	const obj = JSON.parse(result.content[0].text);
	assert.equal(obj.title, "get_tiddler_simple");
	assert.match(obj.text, /line one/);
	// Insertion order: title is first key in serialised JSON.
	assert.equal(Object.keys(obj)[0], "title");
});

test("get_tiddler: plugin tiddler returns fields + buildTree summary", () => {
	const result = getTiddler({ title: "$:/plugins/wikilabs/tw-mcp", detailed: true });
	assert.equal(result.isError, undefined);
	const text = result.content[0].text;
	assert.match(text, /^title: \$:\/plugins\/wikilabs\/tw-mcp/m);
	// Plugin path emits a buildTree summary of subtiddler namespaces.
	assert.match(text, /\$:\/[A-Za-z]+\/\s*\(\d+\)/);
});

// Asserts the documented intent: the handler calls
// `formatTitleTree(shadowTitles, "shadow tiddlers")` passing "shadow tiddlers"
// as a label — but formatTitleTree only emits the label header when buildTree
// returns a non-empty common prefix, which it doesn't for typical $:/-rooted
// plugin subtiddlers. Same root cause as tw-mcp-server-nl1; self-resolves
// when that fix lands.
test.todo("get_tiddler: plugin tiddler shadow tree should carry a 'shadow tiddlers' label", () => {
	const result = getTiddler({ title: "$:/plugins/wikilabs/tw-mcp", detailed: true });
	assert.match(result.content[0].text, /shadow tiddlers/);
});

test("get_tiddler: missing tiddler -> error", () => {
	const result = getTiddler({ title: "DoesNotExist__xyz" });
	assert.equal(result.isError, true);
	assert.match(result.content[0].text, /not found/i);
});

test("get_tiddler: title-only tiddler (minimum-viable) renders only the title line", () => {
	// A tiddler's only required field is `title`. TW UI templates often have
	// no created/modified/type. The handler must not crash or synthesise
	// fields that aren't there.
	$tw.wiki.addTiddler({ title: "title_only_probe" });
	try {
		const result = getTiddler({ title: "title_only_probe" });
		assert.equal(result.isError, undefined);
		const text = result.content[0].text;
		assert.match(text, /^title: title_only_probe$/);
		// Nothing else should appear in the output.
		assert.equal(text.trim(), "title: title_only_probe");
	} finally {
		$tw.wiki.deleteTiddler("title_only_probe");
	}
});

test("get_tiddler: unsafe field (trailing whitespace) falls back to JSON header", () => {
	// hasUnsafeFields flags any non-text field whose trimmed value differs.
	$tw.wiki.addTiddler({ title: "unsafe_probe", description: "leading-space-issue " });
	try {
		const result = getTiddler({ title: "unsafe_probe", detailed: true });
		assert.equal(result.isError, undefined);
		// Default (hashline) mode with unsafe fields uses JSON header.
		assert.match(result.content[0].text, /^\{\s*"title":\s*"unsafe_probe"/);
	} finally {
		$tw.wiki.deleteTiddler("unsafe_probe");
	}
});
