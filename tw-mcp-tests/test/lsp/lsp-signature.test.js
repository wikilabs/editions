"use strict";

/*
Pins signature help: while a call's arguments are typed, the parameter list of
the definition it calls, with the parameter being filled in marked.

To replicate by hand, boot the test edition and ask:

  const f = $tw.modules.execute("$:/core/modules/commands/inspect/lsp/lsp-features.js");
  f.signatureHelp("file:///x.tid", "title: x\n\n\\procedure p(a, b) z\n<<p a:\"1\" ", {line: 3, character: 10});
  // -> {signatures: [{label: "p(a, b)", ...}], activeSignature: 0, activeParameter: 1}
*/

const { test, before } = require("node:test");
const assert = require("node:assert");
const { bootTw, loadHandler } = require("../setup");

const FEATURES_TITLE = "$:/core/modules/commands/inspect/lsp/lsp-features.js";
const LIB_TITLE = "$:/core/modules/commands/inspect/lsp/lsp-lib.js";
const URI = "file:///wiki/tiddlers/lsp_sg.tid";

// Definitions every test document starts with.
const PRELUDE = [
	"\\procedure lsp.sg.p(a, b:\"B\", c) x",
	"\\define lsp.sg.m(a, b) x",
	"\\widget $lsp.sg.w(x, y) <$slot $name=\"ts-raw\"/>",
	"\\function lsp.sg.f(a, b) [[z]]",
	""
].join("\n");

let $tw;
let features;
let lib;

before(async () => {
	$tw = await bootTw();
	features = loadHandler($tw, FEATURES_TITLE);
	lib = loadHandler($tw, LIB_TITLE);
});

function documentAndPosition(body) {
	const marked = "title: lsp_sg\n\n" + PRELUDE + body,
		at = marked.indexOf("@@"),
		lines = marked.slice(0, at).split("\n");
	return { text: marked.replace("@@", ""), position: { line: lines.length - 1, character: lines[lines.length - 1].length } };
}

// Signature help at the @@ in body, written after PRELUDE.
function help(body) {
	const { text, position } = documentAndPosition(body);
	return features.signatureHelp(URI, text, position);
}

function active(body) {
	return help(body).activeParameter;
}

// --- The signature ---

test("the label lists every parameter, each located in it", () => {
	const result = help("<<lsp.sg.p @@"),
		signature = result.signatures[0];
	assert.equal(signature.label, "lsp.sg.p(a, b:\"B\", c)");
	assert.deepEqual(signature.parameters.map((p) => signature.label.slice(p.label[0], p.label[1])), ["a", "b:\"B\"", "c"]);
	assert.equal(result.activeParameter, 0);
	assert.ok(signature.documentation.value.startsWith("**procedure**, defined in this tiddler"), signature.documentation.value);
});

// --- The active parameter ---

test("the first parameter not yet given is active", () => {
	assert.equal(active("<<lsp.sg.p a:\"1\" @@"), 1);
});

test("after name: that parameter is active, typed or not", () => {
	assert.equal(active("<<lsp.sg.p b:@@"), 1);
	assert.equal(active("<<lsp.sg.p c:\"x@@"), 2);
});

test("a positional value marks the parameter it binds to, by the definition's rule", () => {
	// A procedure binds by index, so a second positional value is b.
	assert.equal(active("<<lsp.sg.p \"1\" \"x@@"), 1);
	// Its index 0 is already named, so the value binds to nothing.
	assert.equal(active("<<lsp.sg.p a:\"1\" \"x@@"), 3);
	// A macro takes the next free parameter instead.
	assert.equal(active("<<lsp.sg.m a:\"1\" \"x@@"), 1);
});

test("widget-form calls, over several lines too", () => {
	assert.equal(active("<$transclude $variable=\"lsp.sg.p\" a=\"1\" @@"), 1);
	assert.equal(active("<$macrocall $name=\"lsp.sg.p\"\n\ta=\"1\"\n\tc=@@"), 2);
});

test("a custom widget shows its parameters", () => {
	const result = help("<$lsp.sg.w y=@@");
	assert.equal(result.signatures[0].label, "$lsp.sg.w(x, y)");
	assert.equal(result.activeParameter, 1);
});

test("a dotted function in a filter binds its operands by index", () => {
	const result = help("<$list filter=\"[lsp.sg.f[1],[@@");
	assert.equal(result.signatures[0].label, "lsp.sg.f(a, b)");
	assert.equal(result.activeParameter, 1);
});

test("a variable operand with arguments is a call too", () => {
	assert.equal(active("<$list filter='[<lsp.sg.f \"1\" @@"), 1);
});

test("a name the definition does not declare is pointed out", () => {
	assert.ok(help("<<lsp.sg.p z:\"1\" @@").signatures[0].documentation.value.includes("`z`"));
});

test("a JavaScript macro shows its declared parameters", () => {
	assert.ok(help("<<now @@").signatures[0].label.startsWith("now("));
});

// --- Nothing ---

test("no help for a JavaScript widget, a closed call, or a name still being typed", () => {
	assert.equal(help("<$list @@"), null);
	assert.equal(help("<<lsp.sg.p>> @@"), null);
	assert.equal(help("<<lsp.sg.@@"), null);
	assert.equal(help("<$transclude $variable=\"lsp.sg.@@"), null);
});

// --- Protocol ---

test("the server advertises signature help and answers the request", () => {
	const sent = [];
	const session = lib.createSession((message) => sent.push(message), { schedule: (fn) => { fn(); return 0; }, cancel: () => {} });
	session.dispatch({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} });
	assert.deepEqual(sent[0].result.capabilities.signatureHelpProvider, { triggerCharacters: [" ", ":", "="], retriggerCharacters: ["\""] });
	const { text, position } = documentAndPosition("<<lsp.sg.p @@");
	session.dispatch({ jsonrpc: "2.0", method: "textDocument/didOpen", params: { textDocument: { uri: URI, text: text, version: 1 } } });
	session.dispatch({ jsonrpc: "2.0", id: 2, method: "textDocument/signatureHelp", params: { textDocument: { uri: URI }, position: position } });
	const reply = sent.find((message) => message.id === 2);
	assert.equal(reply.result.signatures[0].label, "lsp.sg.p(a, b:\"B\", c)");
});
