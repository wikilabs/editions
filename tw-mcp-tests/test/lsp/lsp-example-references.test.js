"use strict";

/*
Pins LSP Find References - (Example): Shift+F12 on each name it points at lists
what it says, as VS Code asks (includeDeclaration true, the Example open). Needs
no docs tiddlers; the list-links row reads the core's shadow tiddlers.

To replicate by hand, boot the test edition (cwd editions/tw-mcp-tests) and run:

  const helper = require("./test/lsp/example-helper");
  const f = $tw.modules.execute("$:/core/modules/commands/inspect/lsp/lsp-features.js");
  const example = helper.readExample(f, "LSP Find References - (Example)");
  const at = helper.positionOf(example.text, "<$lsp.greeting/>", {offset: 2});
  f.references(example.uri, example.text, at, {includeDeclaration: true}, {[example.uri]: example.text}).map((l) => l.range.start.line);
  // -> [7, 21]
*/

const { test, before } = require("node:test");
const assert = require("node:assert");
const { bootTw, loadHandler } = require("../setup");
const helper = require("./example-helper");

const FEATURES_TITLE = "$:/core/modules/commands/inspect/lsp/lsp-features.js";
const EXAMPLE = "LSP Find References - (Example)";
// The bullet calls of lsp.who, each as it is written on the page.
const BULLET_CALLS = [
	"a macro call: <<lsp.who>>",
	'<$macrocall $name="lsp.who"/>',
	'<$transclude $variable="lsp.who"/>',
	"<$text text=<<lsp.who>>/>",
	'filter="[<lsp.who>]"',
	'filter="[function[lsp.who]]"',
	'filter="[lsp.who[]]"'
];

let $tw;
let features;
let example;

before(async () => {
	$tw = await bootTw();
	features = loadHandler($tw, FEATURES_TITLE);
	example = helper.readExample(features, EXAMPLE);
});

// Shift+F12 on name inside the first occurrence of snippet, in document order.
function references(snippet, name) {
	const at = helper.positionOf(example.text, snippet, { offset: snippet.indexOf(name) });
	return features.references(example.uri, example.text, at, { includeDeclaration: true }, { [example.uri]: example.text })
		.sort((a, b) => a.range.start.line - b.range.start.line || a.range.start.character - b.range.start.character);
}

// The location of name inside the first occurrence of snippet in the Example.
function inExample(snippet, name) {
	const start = helper.positionOf(example.text, snippet, { offset: snippet.indexOf(name) });
	return { uri: example.uri, range: { start: start, end: { line: start.line, character: start.character + name.length } } };
}

test("on any call of lsp.who the list holds every call on this page, the one inside lsp.hello, the definition and the caption field", () => {
	const expected = [
		inExample("caption: <<lsp.who>>", "lsp.who"),
		inExample("\\function lsp.who()", "lsp.who"),
		inExample("Hello, <<lsp.who>>!", "lsp.who")
	].concat(BULLET_CALLS.map((call) => inExample(call, "lsp.who")));
	BULLET_CALLS.forEach((call) => {
		assert.deepEqual(references(call, "lsp.who"), expected, call);
	});
});

test("on $lsp.greeting the list holds that call and its \\widget definition", () => {
	assert.deepEqual(references("<$lsp.greeting/>", "lsp.greeting"), [
		inExample("\\widget $lsp.greeting()", "$lsp.greeting"),
		inExample("<$lsp.greeting/>", "$lsp.greeting")
	]);
});

test("on list-links the core's own calls are listed too, each opening its tiddler read-only", () => {
	const found = references('<<list-links "[[LSP Find References]]">>', "list-links"),
		core = found.filter((location) => features.isVirtualUri(location.uri)).map((location) => features.titleOfVirtualUri(location.uri));
	assert.ok(found.some((location) => location.uri === example.uri), "the call on this page");
	assert.ok(core.some((title) => title !== "$:/core/macros/list"), "a core call besides the definition: " + core.join(", "));
	core.forEach((title) => assert.ok($tw.wiki.isShadowTiddler(title), title));
});
