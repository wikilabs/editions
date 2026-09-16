"use strict";

/*
Pins LSP Document Symbols - (Example): the outline its table describes, nested
as it says, with each heading's section running to the next heading as high or
higher. Needs no docs tiddlers.

To replicate by hand, boot the test edition (cwd editions/tw-mcp-tests) and run:

  const helper = require("./test/lsp/example-helper");
  const f = $tw.modules.execute("$:/core/modules/commands/inspect/lsp/lsp-features.js");
  const example = helper.readExample(f, "LSP Document Symbols - (Example)");
  f.documentSymbols(example.uri, example.text, {hierarchical: true}).map((s) => s.name);
  // -> ["lsp.ds.outer", "lsp.ds.count", "$lsp.ds.box", "You should see", "Back"]
*/

const { test, before } = require("node:test");
const assert = require("node:assert");
const { bootTw, loadHandler } = require("../setup");
const helper = require("./example-helper");

const FEATURES_TITLE = "$:/core/modules/commands/inspect/lsp/lsp-features.js";
const EXAMPLE = "LSP Document Symbols - (Example)";
// LSP SymbolKind, as lsp-symbols.js answers them.
const CLASS = 5;
const FUNCTION = 12;
const STRING = 15;
const OPERATOR = 25;
const PINNED = [
	'|`lsp.ds.outer` |Function |`(tag, sort:"title")` |',
	"|`lsp.ds.inner`, nested under the one above |Function |`()` |",
	"|`lsp.ds.count` |Operator |`()` |",
	"|`$lsp.ds.box` |Class |`()` |",
	"|You should see |String | |",
	"|A subsection, nested under the one above |String | |",
	"|Back |String | |"
];

let features;
let example;

before(async () => {
	const $tw = await bootTw();
	features = loadHandler($tw, FEATURES_TITLE);
	example = helper.readExample(features, EXAMPLE);
});

function symbols() {
	return features.documentSymbols(example.uri, example.text, { hierarchical: true });
}

function outline(list) {
	return list.map((s) => ({ name: s.name, kind: s.kind, detail: s.detail || "", children: outline(s.children || []) }));
}

function notAfter(a, b) {
	return a.line < b.line || (a.line === b.line && a.character <= b.character);
}

test("every row of the table is pinned here", () => {
	const rows = example.text.split("\n").filter((line) => line.startsWith("|") && !line.startsWith("|!"));
	assert.deepEqual(rows, PINNED);
});

test("the outline shows what the table lists, nested as it says", () => {
	assert.deepEqual(outline(symbols()), [
		{
			name: "lsp.ds.outer",
			kind: FUNCTION,
			detail: '(tag, sort:"title")',
			children: [{ name: "lsp.ds.inner", kind: FUNCTION, detail: "()", children: [] }]
		},
		{ name: "lsp.ds.count", kind: OPERATOR, detail: "()", children: [] },
		{ name: "$lsp.ds.box", kind: CLASS, detail: "()", children: [] },
		{
			name: "You should see",
			kind: STRING,
			detail: "",
			children: [{ name: "A subsection", kind: STRING, detail: "", children: [] }]
		},
		{ name: "Back", kind: STRING, detail: "", children: [] }
	]);
});

test("a heading's section runs down to the next heading as high or higher", () => {
	const seeing = symbols().find((s) => s.name === "You should see"),
		back = helper.positionOf(example.text, "\n!! Back", { offset: 1 });
	assert.deepEqual(seeing.range.start, helper.positionOf(example.text, "\n!! You should see", { offset: 1 }));
	assert.deepEqual(seeing.range.end, back);
	assert.deepEqual(seeing.children[0].range.end, back, "an !!! section ends at the next !! too");
});

test("every symbol's name lies inside its range, or the editor drops the outline", () => {
	const check = (list) => list.forEach((s) => {
		assert.ok(notAfter(s.range.start, s.selectionRange.start) && notAfter(s.selectionRange.end, s.range.end), s.name);
		check(s.children || []);
	});
	check(symbols());
});
