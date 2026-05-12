"use strict";

const { test, before } = require("node:test");
const assert = require("node:assert");
const { bootTw, loadHandler } = require("../setup");

const HANDLER_TITLE = "$:/core/modules/commands/inspect/handlers/inspect/inspect_tree.js";

let inspectTree;

before(async () => {
	const $tw = await bootTw();
	inspectTree = loadHandler($tw, HANDLER_TITLE).inspect_tree;
});

test("inspect_tree: basic wikitext returns type summary + tree JSON", () => {
	const result = inspectTree({ text: "! Heading" });
	assert.equal(result.isError, undefined);
	const text = result.content[0].text;
	assert.match(text, /^Total: \d+ nodes/m);
	assert.match(text, /Types: /);
	assert.match(text, /\(showing depth=3\)/);
});

test("inspect_tree: links surface as 'Links (N): ...' header line", () => {
	const result = inspectTree({ text: "Hello [[Target]] world" });
	assert.match(result.content[0].text, /Links \(1\): Target/);
});

test("inspect_tree: depth=1 collapses deeper subtrees into '{N nodes}'", () => {
	const result = inspectTree({ text: "! Heading\n\nbody with [[link]]", depth: 1 });
	assert.match(result.content[0].text, /\{\d+ nodes\}/);
});

test("inspect_tree: exclude drops named attribute from output", () => {
	const result = inspectTree({ text: "[[Target]]", exclude: ["to"] });
	const text = result.content[0].text;
	assert.doesNotMatch(text, /"to":\s*"Target"/);
});

test("inspect_tree: text nodes over 10 chars elided as '…N'", () => {
	const result = inspectTree({ text: "this is a fairly long text node" });
	assert.match(result.content[0].text, /"text":\s*"…\d+"/);
});

test("inspect_tree: include=['text'] inlines text up to 2000 chars", () => {
	const result = inspectTree({ text: "verbatim text", include: ["text"] });
	assert.match(result.content[0].text, /"text":\s*"verbatim text"/);
});

test("inspect_tree: include=['text'] truncates very long text with head/tail sample", () => {
	const big = "x".repeat(2500);
	const result = inspectTree({ text: big, include: ["text"] });
	// "…2500:xxxx…xxxx" pattern (head+tail)
	assert.match(result.content[0].text, /"text":\s*"…2500:/);
});

test("inspect_tree: many children produce '+N more' marker", () => {
	// 12 list items > maxChildren=10
	const items = Array.from({length: 12}, (_, i) => "* item " + (i + 1)).join("\n");
	const result = inspectTree({ text: items });
	assert.match(result.content[0].text, /\+\d+ more/);
});

test("inspect_tree: text over MAX_TEXT_LENGTH -> error", () => {
	const result = inspectTree({ text: "x".repeat(500001) });
	assert.equal(result.isError, true);
	assert.match(result.content[0].text, /too long/i);
});
