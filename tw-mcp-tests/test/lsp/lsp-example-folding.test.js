"use strict";

/*
Pins LSP Folding - (Example): a fold starts at each place its list names, and
ends where the reader expects. Needs no docs tiddlers.

To replicate by hand, boot the test edition (cwd editions/tw-mcp-tests) and run:

  const helper = require("./test/lsp/example-helper");
  const f = $tw.modules.execute("$:/core/modules/commands/inspect/lsp/lsp-features.js");
  const example = helper.readExample(f, "LSP Folding - (Example)");
  f.foldingRanges(example.uri, example.text).map((r) => r.startLine + "-" + r.endLine);
  // -> ["0-2", "4-7", "8-15", "9-10", "11-12", "13-14", "27-32", "29-32", "30-31", "35-37"]
*/

const { test, before } = require("node:test");
const assert = require("node:assert");
const { bootTw, loadHandler } = require("../setup");
const helper = require("./example-helper");

const FEATURES_TITLE = "$:/core/modules/commands/inspect/lsp/lsp-features.js";
const EXAMPLE = "LSP Folding - (Example)";

let features;
let example;

before(async () => {
	const $tw = await bootTw();
	features = loadHandler($tw, FEATURES_TITLE);
	example = helper.readExample(features, EXAMPLE);
});

function lineOf(snippet, options) {
	return helper.positionOf(example.text, snippet, options).line;
}

// The one fold starting at startLine must end at endLine.
function assertFold(startLine, endLine) {
	const starting = features.foldingRanges(example.uri, example.text)
		.filter((r) => r.startLine === startLine)
		.map((r) => ({ startLine: r.startLine, endLine: r.endLine }));
	assert.deepEqual(starting, [{ startLine: startLine, endLine: endLine }]);
}

test("the header fields at the top of the file fold", () => {
	assertFold(0, lineOf("\n\n"));
});

test("the comment folds", () => {
	assertFold(lineOf("<!--"), lineOf("\n-->\n", { offset: 1 }));
});

test("\\procedure lsp.fr.choose folds down to the line before \\end", () => {
	assertFold(lineOf("\\procedure lsp.fr.choose"), lineOf("\n\\end\n", { offset: 1 }) - 1);
});

test("each of <%if%>, <%elseif%> and <%else%> folds on its own", () => {
	assertFold(lineOf("<%if "), lineOf("<%elseif ") - 1);
	assertFold(lineOf("<%elseif "), lineOf("<%else%>") - 1);
	assertFold(lineOf("<%else%>"), lineOf("<%endif%>") - 1);
});

test("the <$list widget folds, and its content from the > that ends its opening tag", () => {
	const close = lineOf("</$list>");
	assertFold(lineOf("<$list filter="), close - 1);
	assertFold(lineOf("\n>\n", { offset: 1 }), close - 1);
});

test("the code block folds", () => {
	assertFold(lineOf("\n```\ncode\n", { offset: 1 }), lineOf("block\n```", { offset: 6 }) - 1);
});
