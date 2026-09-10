"use strict";

/*
Pins document highlight: with the cursor on a name, every place in the same
document where it means the same thing, the definition or declaration marked as
a write and each use as a read.

To replicate by hand, boot the test edition and ask:

  const f = $tw.modules.execute("$:/core/modules/commands/inspect/lsp/lsp-features.js");
  f.documentHighlights("file:///x.tid", "title: x\n\n\\procedure p() y\n<<p>>", {line: 2, character: 11});
  // -> [{range: <p on line 2>, kind: 3}, {range: <p on line 3>, kind: 2}]
*/

const { test, before } = require("node:test");
const assert = require("node:assert");
const { bootTw, loadHandler } = require("../setup");

const FEATURES_TITLE = "$:/core/modules/commands/inspect/lsp/lsp-features.js";
const LIB_TITLE = "$:/core/modules/commands/inspect/lsp/lsp-lib.js";
const URI = "file:///wiki/tiddlers/lsp_hl.tid";

// One document holding a top-level definition, a nested namesake, a parameter
// of the same name, a call in a header field and two unrelated `tag` scopes.
const TEXT = [
	"title: lsp_hl",
	"caption: <<lsp.hl>>",
	"",
	"\\procedure lsp.hl() top",
	"\\procedure lsp.outer(tag)",
	"\\procedure lsp.hl() nested",
	"<<lsp.hl>> <<tag>>",
	"\\end",
	"\\procedure lsp.other(lsp.hl)",
	"<<lsp.hl>>",
	"\\end",
	"<<lsp.hl>> <<tag>>",
	"<$let tag=\"x\"><<tag>></$let> <<list-links>> <<list-links>>"
].join("\n");

let $tw;
let features;
let lib;

before(async () => {
	$tw = await bootTw();
	features = loadHandler($tw, FEATURES_TITLE);
	lib = loadHandler($tw, LIB_TITLE);
});

// Highlights from a line and column of TEXT, as "line:character W|R" each.
function lit(line, character) {
	const found = features.documentHighlights(URI, TEXT, { line: line, character: character });
	return found === null ? null : found.map((h) => h.range.start.line + ":" + h.range.start.character + " " + (h.kind === 3 ? "W" : h.kind === 2 ? "R" : h.kind));
}

// --- Definitions ---

test("a definition lights up with every call that reaches it", () => {
	assert.deepEqual(lit(3, 11), ["3:11 W", "11:2 R"]);
});

test("a call lights up the same set as its definition", () => {
	assert.deepEqual(lit(11, 3), ["3:11 W", "11:2 R"]);
});

test("a nested definition has its own calls, hidden from the top-level one", () => {
	assert.deepEqual(lit(5, 11), ["5:11 W", "6:2 R"]);
});

test("a call in a header field is not a call of this body's definition", () => {
	assert.deepEqual(lit(1, 11), ["1:11 R"]);
});

test("a name defined outside the document lights up each call, and nothing as its definition", () => {
	assert.deepEqual(lit(12, 32), ["12:31 R", "12:46 R"]);
});

// --- Parameters and variables ---

test("a parameter lights up in its own body, its declaration marked as the write", () => {
	assert.deepEqual(lit(6, 13), ["4:21 W", "6:13 R"]);
});

test("a parameter named like a definition is the parameter inside its body", () => {
	assert.deepEqual(lit(9, 2), ["8:21 W", "9:2 R"]);
});

test("a widget's variable lights up inside that widget only", () => {
	assert.deepEqual(lit(12, 16), ["12:6 W", "12:16 R"]);
});

test("a name no scope binds is not lit where a scope binds it", () => {
	assert.deepEqual(lit(11, 13), ["11:13 R"]);
});

test("nothing is lit off a name", () => {
	assert.equal(lit(3, 21), null);
});

// --- Protocol ---

test("the server advertises document highlight and answers the request", () => {
	const sent = [];
	const session = lib.createSession((message) => sent.push(message), { schedule: (fn) => { fn(); return 0; }, cancel: () => {} });
	session.dispatch({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} });
	assert.equal(sent[0].result.capabilities.documentHighlightProvider, true);
	session.dispatch({ jsonrpc: "2.0", method: "textDocument/didOpen", params: { textDocument: { uri: URI, text: TEXT, version: 1 } } });
	session.dispatch({ jsonrpc: "2.0", id: 2, method: "textDocument/documentHighlight", params: { textDocument: { uri: URI }, position: { line: 3, character: 11 } } });
	const reply = sent.find((message) => message.id === 2);
	assert.equal(reply.result.length, 2, JSON.stringify(reply));
});
