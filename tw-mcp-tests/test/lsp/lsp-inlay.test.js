"use strict";

/*
Pins inlay hints: each positional argument is labelled with the parameter it
binds to, by the definition's own rule, and only where the name resolves.

To replicate by hand, boot the test edition and ask:

  const f = $tw.modules.execute("$:/core/modules/commands/inspect/lsp/lsp-features.js");
  f.inlayHints("file:///x.tid", "title: x\n\n\\procedure p(a) z\n<<p \"v\">>");
  // -> [{position: {line: 3, character: 4}, label: "a:", kind: 2, paddingRight: true}]
*/

const { test, before } = require("node:test");
const assert = require("node:assert");
const { bootTw, loadHandler } = require("../setup");

const FEATURES_TITLE = "$:/core/modules/commands/inspect/lsp/lsp-features.js";
const LIB_TITLE = "$:/core/modules/commands/inspect/lsp/lsp-lib.js";
const URI = "file:///wiki/tiddlers/lsp_ih.tid";

// Definitions every test document starts with; the body follows on line 5.
const PRELUDE = [
	"title: lsp_ih",
	"",
	"\\procedure lsp.ih.p(a, b:\"B\") x",
	"\\define lsp.ih.m(a, b) x",
	"\\function lsp.ih.f(a, b) [[z]]",
	""
].join("\n");
const LINE = 5;

let $tw;
let features;
let lib;

before(async () => {
	$tw = await bootTw();
	features = loadHandler($tw, FEATURES_TITLE);
	lib = loadHandler($tw, LIB_TITLE);
});

// Each hint on the body's first line as "label@text after it".
function hints(body) {
	const text = PRELUDE + body;
	return features.inlayHints(URI, text).map((hint) => {
		assert.equal(hint.kind, 2);
		assert.equal(hint.paddingRight, true);
		return hint.label + "@" + text.split("\n")[hint.position.line].slice(hint.position.character, hint.position.character + 3);
	});
}

test("positional arguments are labelled, each at its value", () => {
	assert.deepEqual(hints("<<lsp.ih.p \"x\" \"y\">>"), ["a:@\"x\"", "b:@\"y\""]);
});

test("a named argument gets no label", () => {
	assert.deepEqual(hints("<<lsp.ih.p b:\"y\" \"x\">>"), ["a:@\"x\""]);
});

test("the binding rule is the definition's own", () => {
	// A procedure binds by index: a is named, so "y" binds to nothing.
	assert.deepEqual(hints("<<lsp.ih.p a:\"1\" \"y\">>"), []);
	// A macro takes the next free parameter.
	assert.deepEqual(hints("<<lsp.ih.m a:\"1\" \"y\">>"), ["b:@\"y\""]);
});

test("a name that does not resolve gets no labels", () => {
	assert.deepEqual(hints("<<lsp.ih.none \"x\">>"), []);
});

test("a JavaScript macro's declared parameters label its arguments", () => {
	assert.deepEqual(hints("<<now \"YYYY\">>"), ["format:@\"YY"]);
});

test("a dotted function's operands are labelled by index", () => {
	assert.deepEqual(hints("{{{ [lsp.ih.f[1],[2]] }}}"), ["a:@[1]", "b:@[2]"]);
	// A suffix comes before the operands.
	assert.deepEqual(hints("{{{ [lsp.ih.f:s[1]] }}}"), ["a:@[1]"]);
});

test("a variable operand's arguments are labelled as a call's", () => {
	assert.deepEqual(hints("{{{ [<lsp.ih.f \"1\" \"2\">] }}}"), ["a:@\"1\"", "b:@\"2\""]);
});

test("only hints inside the requested range are sent", () => {
	const text = PRELUDE + "<<lsp.ih.p \"x\">>\n<<lsp.ih.p \"y\">>",
		range = { start: { line: LINE + 1, character: 0 }, end: { line: LINE + 1, character: 20 } };
	assert.deepEqual(features.inlayHints(URI, text, range).map((hint) => hint.position.line), [LINE + 1]);
});

test("a tiddler that is not wikitext gets no hints", () => {
	assert.deepEqual(features.inlayHints(URI, "title: lsp_ih\ntype: application/javascript\n\n<<now \"x\">>"), []);
});

test("the server advertises inlay hints and answers the request", () => {
	const sent = [];
	const session = lib.createSession((message) => sent.push(message), { schedule: (fn) => { fn(); return 0; }, cancel: () => {} });
	session.dispatch({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} });
	assert.equal(sent[0].result.capabilities.inlayHintProvider, true);
	const text = PRELUDE + "<<lsp.ih.p \"x\">>";
	session.dispatch({ jsonrpc: "2.0", method: "textDocument/didOpen", params: { textDocument: { uri: URI, text: text, version: 1 } } });
	session.dispatch({ jsonrpc: "2.0", id: 2, method: "textDocument/inlayHint", params: { textDocument: { uri: URI }, range: { start: { line: 0, character: 0 }, end: { line: LINE + 1, character: 0 } } } });
	const reply = sent.find((message) => message.id === 2);
	assert.deepEqual(reply.result.map((hint) => hint.label), ["a:"]);
});
