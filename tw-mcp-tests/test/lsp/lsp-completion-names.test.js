"use strict";

/*
Pins completion of names: where TiddlyWiki expects a call's name, a widget, a
parameter not yet given, a variable or function in a filter, or an operator.

To replicate by hand, boot the test edition and ask:

  const f = $tw.modules.execute("$:/core/modules/commands/inspect/lsp/lsp-features.js");
  f.completions("file:///x.tid", "title: x\n\n\\procedure p(a) z\n<<p ", {line: 3, character: 4});
  // -> {isIncomplete: true, items: [{label: "a:", kind: 10, ...}]}
*/

const { test, before } = require("node:test");
const assert = require("node:assert");
const { bootTw, loadHandler } = require("../setup");

const FEATURES_TITLE = "$:/core/modules/commands/inspect/lsp/lsp-features.js";
const URI = "file:///wiki/tiddlers/lsp_cp.tid";
const FUNCTION = 3;
const CLASS = 7;
const PROPERTY = 10;
const OPERATOR = 24;

// Definitions every test document starts with.
const PRELUDE = [
	"\\procedure lsp.cp.p(a, b:\"B\") <<a>>",
	"\\widget $lsp.cp.w(x, y) <$slot $name=\"ts-raw\"/>",
	"\\function lsp.cp.f() [[z]]",
	""
].join("\n");

let $tw;
let features;

before(async () => {
	$tw = await bootTw();
	features = loadHandler($tw, FEATURES_TITLE);
});

// Completion at the @@ in body, written after PRELUDE.
function complete(body) {
	const text = "title: lsp_cp\n\n" + PRELUDE + body.replace("@@", ""),
		at = ("title: lsp_cp\n\n" + PRELUDE + body).indexOf("@@"),
		lines = text.slice(0, at).split("\n");
	return features.completions(URI, text, { line: lines.length - 1, character: lines[lines.length - 1].length });
}

function labels(body) {
	return complete(body).items.map((item) => item.label);
}

// --- Call names ---

test("inside a definition, what binds here comes first, then this tiddler, then globals", () => {
	const found = labels("\\procedure lsp.cp.outer(tag, sort)\n<$let v=\"1\">\n<<@@\n</$let>\n\\end");
	assert.deepEqual(found.slice(0, 3), ["v", "tag", "sort"]);
	assert.ok(found.indexOf("lsp.cp.p") < found.indexOf("list-links"), found.join(", "));
	assert.ok(found.includes("currentTiddler"), "core variables are offered too");
	assert.ok(!found.includes("$lsp.cp.w"), "a widget is not called with <<");
});

test("a name being typed narrows the list, and every item claims the typed text", () => {
	const result = complete("<<lsp.cp.@@");
	assert.deepEqual(result.items.map((item) => item.label), ["lsp.cp.p", "lsp.cp.f"]);
	assert.equal(result.isIncomplete, true);
	result.items.forEach((item) => {
		assert.equal(item.filterText, "lsp.cp.");
		assert.equal(item.textEdit.range.end.character - item.textEdit.range.start.character, "lsp.cp.".length);
	});
	assert.equal(result.items[0].kind, FUNCTION);
});

test("typing on a body's last line still offers its parameters", () => {
	assert.equal(labels("\\procedure lsp.cp.q(tag)\n<<@@\n\\end")[0], "tag");
});

test("a nested definition is offered inside its parent only", () => {
	const nested = "\\procedure lsp.cp.o()\n\\procedure lsp.cp.inner() x\n<<lsp.cp.i@@\n\\end";
	assert.ok(labels(nested).includes("lsp.cp.inner"));
	assert.ok(!labels(nested.replace("@@", "") + "\n<<lsp.cp.i@@").includes("lsp.cp.inner"));
});

test("a name given as $variable is completed like a call", () => {
	assert.deepEqual(labels("<$transclude $variable=\"lsp.cp.@@"), ["lsp.cp.p", "lsp.cp.f"]);
});

// --- Parameters ---

test("a call is offered the parameters it has not been given", () => {
	assert.deepEqual(labels("<<lsp.cp.p @@"), ["a:", "b:"]);
	assert.deepEqual(labels("<<lsp.cp.p a:\"1\" @@"), ["b:"]);
	assert.equal(complete("<<lsp.cp.p @@").items[0].kind, PROPERTY);
});

test("a positional argument counts as given, by the procedure's rule", () => {
	assert.deepEqual(labels("<<lsp.cp.p \"1\" @@"), ["b:"]);
});

test("a parameter name being typed narrows the list, and is not taken as given", () => {
	assert.deepEqual(labels("<<lsp.cp.p a@@"), ["a:"]);
});

test("a widget-form call is offered attributes, over several lines too", () => {
	assert.deepEqual(labels("<$transclude $variable=\"lsp.cp.p\" a=\"1\" @@"), ["b="]);
	assert.deepEqual(labels("<$macrocall $name=\"lsp.cp.p\"\n\ta=\"1\"\n\t@@"), ["b="]);
});

test("a custom widget is offered its parameters", () => {
	assert.deepEqual(labels("<$lsp.cp.w x=\"1\" @@"), ["y="]);
});

// --- Widgets ---

test("a widget's tag offers registered widgets and custom ones in reach", () => {
	assert.ok(labels("<$li@@").includes("list"));
	const custom = complete("<$lsp.@@").items.find((item) => item.label === "lsp.cp.w");
	assert.ok(custom, "expected the \\widget definition");
	assert.equal(custom.kind, CLASS);
});

// --- Filters ---

test("a variable operand offers variables and functions, not widgets", () => {
	const found = labels("<$list filter=\"[<lsp.@@");
	assert.ok(found.includes("lsp.cp.p") && found.includes("lsp.cp.f"), found.join(", "));
	assert.ok(!found.includes("$lsp.cp.w"));
});

test("function[ offers functions only", () => {
	const result = complete("<$list filter=\"[function[@@");
	assert.ok(result.items.some((item) => item.label === "lsp.cp.f"));
	assert.ok(result.items.every((item) => item.detail.startsWith("function ")), result.items.map((i) => i.detail).join(", "));
});

test("an operator name is offered where a step starts", () => {
	const first = complete("<$list filter=\"[ta@@").items.find((item) => item.label === "tag");
	assert.ok(first, "expected tag");
	assert.equal(first.kind, OPERATOR);
	assert.ok(labels("<$list filter=\"[tag[x]so@@").includes("sort"));
	assert.ok(labels("<$list filter=\"[lsp.@@").includes("lsp.cp.f"), "a dotted function runs as an operator");
});

test("a literal operand offers nothing", () => {
	assert.deepEqual(labels("<$list filter=\"[tag[lsp.@@"), []);
});

test("an <%if%> condition is a filter too", () => {
	assert.ok(labels("<%if [<lsp.@@").includes("lsp.cp.f"));
});

// --- Nothing ---

test("[< in prose, or a cursor after a closed call, offers nothing", () => {
	assert.deepEqual(complete("Some [<@@"), { isIncomplete: false, items: [] });
	assert.deepEqual(complete("<<lsp.cp.p>> @@"), { isIncomplete: false, items: [] });
});
