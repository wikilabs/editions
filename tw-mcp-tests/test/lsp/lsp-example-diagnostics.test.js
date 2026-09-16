"use strict";

/*
Pins LSP Diagnostics - (Example): of its four lines only the first is warned, and
a link to a missing title added on a new line is warned too. The docs wiki's
tiddlers are loaded (test scaffolding), since LSP Server has to resolve.

To replicate by hand, boot the test edition (cwd editions/tw-mcp-tests) and run:

  const helper = require("./test/lsp/example-helper");
  const f = $tw.modules.execute("$:/core/modules/commands/inspect/lsp/lsp-features.js");
  helper.loadDocs($tw);
  const example = helper.readExample(f, "LSP Diagnostics - (Example)");
  f.diagnostics(example.uri, example.text).map((d) => d.message);
  // -> ["No tiddler titled 'No Such Tiddler'"]
*/

const { test, before, after } = require("node:test");
const assert = require("node:assert");
const { bootTw, loadHandler } = require("../setup");
const helper = require("./example-helper");

const FEATURES_TITLE = "$:/core/modules/commands/inspect/lsp/lsp-features.js";
const EXAMPLE = "LSP Diagnostics - (Example)";
const WARNING = 2;
const FOUR_LINES = [
	"See [[No Such Tiddler]].",
	"See [[LSP Server]].",
	"Code `[[No Such Tiddler]]` here.",
	"See [[docs|https://tiddlywiki.com]]."
];

let $tw;
let features;
let example;
let unloadDocs;

before(async () => {
	$tw = await bootTw();
	features = loadHandler($tw, FEATURES_TITLE);
	unloadDocs = helper.loadDocs($tw);
	example = helper.readExample(features, EXAMPLE);
});

after(() => unloadDocs());

// A warning as the editor shows it: where, how severe, what it says.
function warnings(text) {
	return features.diagnostics(example.uri, text).map((d) => ({ range: d.range, severity: d.severity, message: d.message }));
}

// The range of title inside the first occurrence of line.
function rangeOf(text, line, title) {
	const start = helper.positionOf(text, line, { offset: line.indexOf(title) });
	return { start: start, end: { line: start.line, character: start.character + title.length } };
}

test("only the first of the four lines is warned, as No tiddler titled 'No Such Tiddler'", () => {
	FOUR_LINES.forEach((line) => helper.positionOf(example.text, "\n" + line + "\n"));
	assert.deepEqual(warnings(example.text), [{
		range: rangeOf(example.text, FOUR_LINES[0], "No Such Tiddler"),
		severity: WARNING,
		message: "No tiddler titled 'No Such Tiddler'"
	}]);
});

test("a link of your own to a title that does not exist is warned", () => {
	const typed = helper.typeAtEnd(example.text, "See [[Nowhere Yet]].");
	assert.deepEqual(warnings(typed.text).slice(1), [{
		range: rangeOf(typed.text, "See [[Nowhere Yet]].", "Nowhere Yet"),
		severity: WARNING,
		message: "No tiddler titled 'Nowhere Yet'"
	}]);
});
