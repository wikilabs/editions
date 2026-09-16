"use strict";

/*
Pins LSP Inlay Hints - (Example): each bullet line gets exactly the labels it
names, in front of the values it names. Needs no docs tiddlers.

To replicate by hand, boot the test edition (cwd editions/tw-mcp-tests) and run:

  const helper = require("./test/lsp/example-helper");
  const f = $tw.modules.execute("$:/core/modules/commands/inspect/lsp/lsp-features.js");
  const example = helper.readExample(f, "LSP Inlay Hints - (Example)");
  f.inlayHints(example.uri, example.text, {start: {line: 0, character: 0}, end: {line: 99, character: 0}}).map((h) => h.label);
  // -> ["a:", "b:", "b:", "filter:", "a:", "b:"]
*/

const { test, before } = require("node:test");
const assert = require("node:assert");
const { bootTw, loadHandler } = require("../setup");
const helper = require("./example-helper");

const FEATURES_TITLE = "$:/core/modules/commands/inspect/lsp/lsp-features.js";
const EXAMPLE = "LSP Inlay Hints - (Example)";

let features;
let example;

before(async () => {
	const $tw = await bootTw();
	features = loadHandler($tw, FEATURES_TITLE);
	example = helper.readExample(features, EXAMPLE);
});

// The labels shown on the bullet holding call, where they stand.
function hintsOn(call) {
	const line = helper.positionOf(example.text, "* " + call).line,
		whole = { start: { line: 0, character: 0 }, end: { line: example.text.split("\n").length, character: 0 } };
	return features.inlayHints(example.uri, example.text, whole)
		.filter((h) => h.position.line === line)
		.map((h) => ({ label: h.label, position: h.position }))
		.sort((a, b) => a.position.character - b.position.character);
}

// A label placed in front of value, inside call.
function label(text, call, value) {
	return { label: text, position: helper.positionOf(example.text, "* " + call, { offset: 2 + call.indexOf(value) }) };
}

test('<<lsp.ih.pair "x" "y">> shows a: before "x", b: before "y"', () => {
	const call = '<<lsp.ih.pair "x" "y">>';
	assert.deepEqual(hintsOn(call), [label("a:", call, '"x"'), label("b:", call, '"y"')]);
});

test('<<lsp.ih.pair a:"x" "y">> shows no label, since a procedure would give "y" to a, which is already named', () => {
	assert.deepEqual(hintsOn('<<lsp.ih.pair a:"x" "y">>'), []);
});

test('<<lsp.ih.macro a:"x" "y">> shows b: before "y", the next parameter left over', () => {
	const call = '<<lsp.ih.macro a:"x" "y">>';
	assert.deepEqual(hintsOn(call), [label("b:", call, '"y"')]);
});

test("{{{ [lsp.ih.fn[x],[y]] }}} shows a: and b: before the operands", () => {
	const call = "{{{ [lsp.ih.fn[x],[y]] }}}";
	assert.deepEqual(hintsOn(call), [label("a:", call, "[x]"), label("b:", call, "[y]")]);
});

test('<<list-links "[tag[LSP Capabilities]]">> shows filter: before the filter', () => {
	const call = '<<list-links "[tag[LSP Capabilities]]">>';
	assert.deepEqual(hintsOn(call), [label("filter:", call, '"[tag')]);
});
