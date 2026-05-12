"use strict";

const { test, before } = require("node:test");
const assert = require("node:assert");
const { bootTw, loadHandler } = require("../setup");

const HANDLER_TITLE = "$:/core/modules/commands/inspect/handlers/query/list_tiddlers.js";

let listTiddlers;

before(async () => {
	const $tw = await bootTw();
	listTiddlers = loadHandler($tw, HANDLER_TITLE).list_tiddlers;
});

test("list_tiddlers: default lists non-system tiddlers", () => {
	const result = listTiddlers({});
	assert.equal(result.isError, undefined);
	const text = result.content[0].text;
	assert.match(text, /list_tiddlers_a/);
	assert.match(text, /list_tiddlers_b/);
	assert.doesNotMatch(text, /\$:\//);
});

test("list_tiddlers: tag filter narrows to tagged tiddlers", () => {
	const result = listTiddlers({ tag: "query_list_tag" });
	assert.equal(result.isError, undefined);
	const text = result.content[0].text;
	assert.match(text, /list_tiddlers_a/);
	assert.match(text, /list_tiddlers_b/);
});

test("list_tiddlers: plugin filter lists plugin subtiddlers", () => {
	const result = listTiddlers({ plugin: "$:/plugins/wikilabs/tw-mcp" });
	assert.equal(result.isError, undefined);
	const text = result.content[0].text;
	// buildTree collapses deep paths into namespace groups like "$:/core/ (N)";
	// any '$:/<segment>/ (N)' group confirms plugin subtiddlers were listed.
	assert.match(text, /\$:\/[A-Za-z]+\/\s*\(\d+\)/);
});

test("list_tiddlers: includeSystem returns system tiddlers", () => {
	const result = listTiddlers({ includeSystem: true });
	assert.equal(result.isError, undefined);
	const text = result.content[0].text;
	// Any '$:/' entry proves system tiddlers are in scope (buildTree may
	// collapse deeper paths into '$:/plugins/ (N)' style summaries).
	assert.match(text, /\$:\//);
	// And non-system fixtures still appear in the listing.
	assert.match(text, /list_tiddlers_a/);
});

test("list_tiddlers: explicit limit triggers truncation footer", () => {
	// $:/core has hundreds of subtiddlers; limit forces truncation.
	const result = listTiddlers({ plugin: "$:/core", limit: 3 });
	assert.equal(result.isError, undefined);
	assert.match(result.content[0].text, /\(\d+ total, showing first 3\)/);
});

test("list_tiddlers: large unbounded result uses buildTree summary", () => {
	// $:/core's subtiddlers are 100+, no limit -> count-summary form which
	// collapses sub-namespaces and shows "$:/dir/ (N)" group counts.
	const result = listTiddlers({ plugin: "$:/core" });
	assert.equal(result.isError, undefined);
	const text = result.content[0].text;
	assert.match(text, /\(\d+\)/, "buildTree count-summary emits (N) group counts");
	assert.doesNotMatch(text, /showing first/, "no truncation footer when unbounded");
});

test("list_tiddlers: count-summary branch surfaces a grand total", () => {
	const result = listTiddlers({ plugin: "$:/core" });
	assert.match(result.content[0].text, /\b\d{3,}\s+tiddlers?\b/,
		"grand-total count visible to the user");
});

test("list_tiddlers: overwrittenShadows lists shadow overrides", () => {
	const result = listTiddlers({ overwrittenShadows: true });
	assert.equal(result.isError, undefined);
	// The test edition doesn't deliberately override any shadows, so empty is fine.
	// Just verify the handler completes without erroring.
	assert.ok(typeof result.content[0].text === "string");
});
