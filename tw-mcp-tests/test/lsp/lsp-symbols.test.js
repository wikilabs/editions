"use strict";

/*
Pins document symbols: a tiddler's outline, as the editor's Outline view,
breadcrumbs and Ctrl+Shift+O show it. Definitions come first, nested ones as
children, then headings nested by level.

To replicate by hand, boot the test edition and ask:

  const f = $tw.modules.execute("$:/core/modules/commands/inspect/lsp/lsp-features.js");
  f.documentSymbols("file:///x.tid", "title: x\n\n\\procedure p(a) hi\n\n! Heading");
  // -> [{name: "p", kind: 12, ...}, {name: "Heading", kind: 15, ...}]
*/

const { test, before } = require("node:test");
const assert = require("node:assert");
const { bootTw, loadHandler } = require("../setup");

const FEATURES_TITLE = "$:/core/modules/commands/inspect/lsp/lsp-features.js";
const LIB_TITLE = "$:/core/modules/commands/inspect/lsp/lsp-lib.js";
const URI = "file:///wiki/tiddlers/probe.tid";

// LSP SymbolKind values.
const FUNCTION = 12;
const OPERATOR = 25;
const CLASS = 5;
const STRING = 15;

let features;
let lib;

before(async () => {
	const $tw = await bootTw();
	features = loadHandler($tw, FEATURES_TITLE);
	lib = loadHandler($tw, LIB_TITLE);
});

function tid(body) {
	return "title: probe\n\n" + body;
}

function symbolsOf(body, options) {
	const text = tid(body);
	return { text: text, symbols: features.documentSymbols(URI, text, options) };
}

// The text a range covers, which may span lines.
function covered(text, range) {
	const lines = text.split("\n");
	if(range.start.line === range.end.line) {
		return lines[range.start.line].slice(range.start.character, range.end.character);
	}
	return [lines[range.start.line].slice(range.start.character)].concat(lines.slice(range.start.line + 1, range.end.line), [lines[range.end.line].slice(0, range.end.character)]).join("\n");
}

// A session initialized with the given client capabilities, answering one outline request.
function outlineOverTheWire(capabilities, body) {
	const sent = [];
	const session = lib.createSession((message) => sent.push(message), { schedule: (fn) => { fn(); return 0; }, cancel: () => {} });
	session.dispatch({ jsonrpc: "2.0", id: 1, method: "initialize", params: { capabilities: capabilities } });
	session.dispatch({ jsonrpc: "2.0", method: "textDocument/didOpen", params: { textDocument: { uri: URI, version: 1, text: tid(body) } } });
	session.dispatch({ jsonrpc: "2.0", id: 2, method: "textDocument/documentSymbol", params: { textDocument: { uri: URI } } });
	return { initialize: sent.find((message) => message.id === 1).result, symbols: sent.find((message) => message.id === 2).result };
}

// --- Definitions ---

test("each kind of definition has its symbol kind, and its parameters as detail", () => {
	const { symbols } = symbolsOf('\\procedure lsp.p(a, b:"B") x\n\\function lsp.f() [[x]]\n\\define lsp.d(x) y\n\\widget $lsp.w() z\n');
	assert.deepEqual(symbols.map((s) => [s.name, s.kind]), [["lsp.p", FUNCTION], ["lsp.f", OPERATOR], ["lsp.d", FUNCTION], ["$lsp.w", CLASS]]);
	assert.equal(symbols[0].detail, '(a, b:"B")');
	assert.equal(symbols[2].detail, "macro (x)", "a \\define says it is one");
});

test("a definition's range is its whole pragma, its selection range its name", () => {
	const { text, symbols } = symbolsOf("\\procedure lsp.p()\n<<x>>\n\\end\n");
	assert.equal(covered(text, symbols[0].range), "\\procedure lsp.p()\n<<x>>\n\\end");
	assert.equal(covered(text, symbols[0].selectionRange), "lsp.p");
});

test("a definition written inside another's body is its child", () => {
	const { symbols } = symbolsOf("\\procedure lsp.outer()\n\t\\procedure lsp.inner() x\n\t<<lsp.inner>>\n\\end\n\\procedure lsp.next() y\n");
	assert.deepEqual(symbols.map((s) => s.name), ["lsp.outer", "lsp.next"]);
	assert.deepEqual(symbols[0].children.map((s) => s.name), ["lsp.inner"]);
});

// --- Headings ---

test("headings nest by level, each spanning its section", () => {
	const { text, symbols } = symbolsOf("! A\n\ntext\n\n!! B\n\n!! C\n\n! D\n");
	assert.deepEqual(symbols.map((s) => [s.name, s.kind]), [["A", STRING], ["D", STRING]]);
	assert.deepEqual(symbols[0].children.map((s) => s.name), ["B", "C"]);
	assert.equal(symbols[0].range.end.line, text.split("\n").indexOf("! D"), "A's section ends where D begins");
	assert.equal(symbols[0].children[0].range.end.line, text.split("\n").indexOf("!! C"), "B's section ends where C begins");
	assert.equal(covered(text, symbols[0].selectionRange), "! A");
});

test("a heading inside a definition body is not one of this tiddler's", () => {
	const { symbols } = symbolsOf("\\procedure lsp.t()\n! Inside\n\\end\n\n! Outside\n");
	assert.deepEqual(symbols.map((s) => s.name), ["lsp.t", "Outside"]);
	assert.deepEqual(symbols[0].children, []);
});

test("a .tid holding no wikitext has no outline", () => {
	assert.deepEqual(features.documentSymbols(URI, "title: probe\ntype: application/javascript\n\n! Not a heading\n"), []);
});

// --- Over the wire ---

test("the server advertises document symbols", () => {
	assert.equal(outlineOverTheWire({}, "").initialize.capabilities.documentSymbolProvider, true);
});

test("a client that nests symbols gets them nested", () => {
	const capabilities = { textDocument: { documentSymbol: { hierarchicalDocumentSymbolSupport: true } } };
	const { symbols } = outlineOverTheWire(capabilities, "\\procedure lsp.outer()\n\t\\procedure lsp.inner() x\n\\end\n");
	assert.deepEqual(symbols.map((s) => s.name), ["lsp.outer"]);
	assert.deepEqual(symbols[0].children.map((s) => s.name), ["lsp.inner"]);
});

test("any other client gets a flat list naming each symbol's container", () => {
	const { symbols } = outlineOverTheWire({}, "\\procedure lsp.outer()\n\t\\procedure lsp.inner() x\n\\end\n");
	assert.deepEqual(symbols.map((s) => [s.name, s.containerName]), [["lsp.outer", undefined], ["lsp.inner", "lsp.outer"]]);
	assert.equal(symbols[1].location.uri, URI);
});
