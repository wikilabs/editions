"use strict";

/*
Pins LSP Document Highlight - (Example): for each row of its table, the cursor on
the name lights up exactly what the row says. Needs no docs tiddlers.

To replicate by hand, boot the test edition (cwd editions/tw-mcp-tests) and run:

  const helper = require("./test/lsp/example-helper");
  const f = $tw.modules.execute("$:/core/modules/commands/inspect/lsp/lsp-features.js");
  const example = helper.readExample(f, "LSP Document Highlight - (Example)");
  const at = helper.positionOf(example.text, "<<who>></$let>", {offset: 2});
  f.documentHighlights(example.uri, example.text, at).map((h) => h.range.start);
  // -> [{line: 10, character: 6}, {line: 10, character: 18}]
*/

const { test, before } = require("node:test");
const assert = require("node:assert");
const { bootTw, loadHandler } = require("../setup");
const helper = require("./example-helper");

const FEATURES_TITLE = "$:/core/modules/commands/inspect/lsp/lsp-features.js";
const EXAMPLE = "LSP Document Highlight - (Example)";

let features;
let example;

before(async () => {
	const $tw = await bootTw();
	features = loadHandler($tw, FEATURES_TITLE);
	example = helper.readExample(features, EXAMPLE);
});

// Where name sits inside the first occurrence of snippet, with the text it covers.
function nameIn(snippet, name) {
	const at = helper.positionOf(example.text, snippet, { offset: snippet.indexOf(name) });
	return { line: at.line, character: at.character, text: name };
}

// What lights up with the cursor on spot, in document order.
function lit(spot) {
	const lines = example.text.split("\n");
	return features.documentHighlights(example.uri, example.text, { line: spot.line, character: spot.character })
		.map((h) => ({ line: h.range.start.line, character: h.range.start.character, text: lines[h.range.start.line].slice(h.range.start.character, h.range.end.character) }))
		.sort((a, b) => a.line - b.line || a.character - b.character);
}

test("who in the body of lsp.dh.greet lights up its declaration in the head and both uses in that body, nothing else", () => {
	const expected = [nameIn("greet(who)", "who"), nameIn("Hello <<who>>", "who"), nameIn("[<who>]", "who")];
	assert.deepEqual(lit(expected[1]), expected);
	assert.deepEqual(lit(expected[2]), expected, "from the use in the filter too");
});

test("who inside the $let lights up the $let's who and the use inside it", () => {
	const expected = [nameIn('<$let who="you">', "who"), nameIn("<<who>></$let>", "who")];
	assert.deepEqual(lit(expected[1]), expected);
});

test("lsp.dh.greet in the first call lights up the definition's name and both calls on that line, not the call inside lsp.dh.outer", () => {
	const call = nameIn('<<lsp.dh.greet who:"World">>', "lsp.dh.greet"),
		hidden = nameIn("<<lsp.dh.greet>>", "lsp.dh.greet");
	assert.equal(hidden.line, helper.positionOf(example.text, "\\procedure lsp.dh.outer").line, "the first <<lsp.dh.greet>> is the one in lsp.dh.outer");
	assert.deepEqual(lit(call), [
		nameIn("\\procedure lsp.dh.greet", "lsp.dh.greet"),
		call,
		nameIn('"World">> <<lsp.dh.greet>>', "lsp.dh.greet")
	]);
});
