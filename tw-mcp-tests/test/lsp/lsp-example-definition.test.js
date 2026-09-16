"use strict";

/*
Pins LSP Go to Definition - (Example): each target of its table and its link list
opens what it says. Core targets are pinned by the code they select, not by line.
The docs wiki's tiddlers are loaded (test scaffolding), so LSP Server has a file.

To replicate by hand, boot the test edition (cwd editions/tw-mcp-tests) and run:

  const helper = require("./test/lsp/example-helper");
  const f = $tw.modules.execute("$:/core/modules/commands/inspect/lsp/lsp-features.js");
  helper.loadDocs($tw);
  const example = helper.readExample(f, "LSP Go to Definition - (Example)");
  const at = helper.positionOf(example.text, "+[limit[2]]", {offset: 2});
  f.definition(example.uri, example.text, at, {linkSupport: false}, {[example.uri]: example.text}).uri;
  // -> "tiddlywiki:/%24%3A%2Fcore%2Fmodules%2Ffilters%2Flimit.js"
*/

const { test, before, after } = require("node:test");
const assert = require("node:assert");
const path = require("node:path");
const { bootTw, loadHandler } = require("../setup");
const helper = require("./example-helper");

const FEATURES_TITLE = "$:/core/modules/commands/inspect/lsp/lsp-features.js";
const EXAMPLE = "LSP Go to Definition - (Example)";
const PINNED = [
	"|`lsp.gd.greet` in the first call |the `\\procedure lsp.gd.greet(who)` line at the top |",
	"|`lsp.gd.greet` inside `lsp.gd.outer` |the nested definition just above it |",
	"|`who` in `Hello <<who>>` |`who` in the head of `lsp.gd.greet` |",
	'|`page` in `<<page>>` |the `variable="page"` attribute of the `$list` |',
	"|`$list` |the list widget's constructor, read-only |",
	"|`limit` |`exports.limit` in the limit operator's module, read-only |",
	"|`+` |the module of the `:and` run prefix, read-only |",
	"|`list-links` |its definition in `$:/core/macros/list`, read-only |",
	"|`now` |the `run` function of the now macro, read-only |"
];

let features;
let example;
let unloadDocs;

before(async () => {
	const $tw = await bootTw();
	features = loadHandler($tw, FEATURES_TITLE);
	unloadDocs = helper.loadDocs($tw);
	example = helper.readExample(features, EXAMPLE);
});

after(() => unloadDocs());

// Where ctrl-click at offset into the first occurrence of snippet goes, always as a list.
function open(snippet, offset) {
	const at = helper.positionOf(example.text, snippet, { offset: offset });
	return [].concat(features.definition(example.uri, example.text, at, { linkSupport: false }, { [example.uri]: example.text }) || []);
}

// The location of name inside the first occurrence of snippet in the Example.
function inExample(snippet, name) {
	const start = helper.positionOf(example.text, snippet, { offset: snippet.indexOf(name) });
	return { uri: example.uri, range: { start: start, end: { line: start.line, character: start.character + name.length } } };
}

// A read-only view as the tiddler it shows, the text it selects and the line holding it.
function readOnly(location) {
	assert.ok(features.isVirtualUri(location.uri), location.uri + " should open read-only");
	const title = features.titleOfVirtualUri(location.uri),
		line = features.virtualText(title).split("\n")[location.range.start.line];
	return { title: title, selected: line.slice(location.range.start.character, location.range.end.character), line: line };
}

test("every row of the table is pinned here", () => {
	const rows = example.text.split("\n").filter((line) => line.startsWith("|`"));
	assert.deepEqual(rows, PINNED);
});

// --- Calls, parameters and operators ---

test("lsp.gd.greet in the first call opens the \\procedure lsp.gd.greet(who) line at the top", () => {
	assert.deepEqual(open('<<lsp.gd.greet who:"World">>', 2), [inExample("\\procedure lsp.gd.greet(who)", "lsp.gd.greet")]);
});

test("lsp.gd.greet inside lsp.gd.outer opens the nested definition just above it", () => {
	assert.deepEqual(open("\n<<lsp.gd.greet>>\n", 3), [inExample("\\procedure lsp.gd.greet() nested", "lsp.gd.greet")]);
});

test("who in Hello <<who>> opens who in the head of lsp.gd.greet", () => {
	assert.deepEqual(open("Hello <<who>>", 8), [inExample("greet(who)", "who")]);
});

test('page in <<page>> opens the variable="page" attribute of the $list', () => {
	assert.deepEqual(open("<<page>> </$list>", 2), [inExample('variable="page"', "page")]);
});

test("$list opens the list widget's constructor, read-only", () => {
	const target = open("<$list filter=", 2);
	assert.equal(target.length, 1);
	const view = readOnly(target[0]);
	assert.equal(view.title, "$:/core/modules/widgets/list.js");
	assert.match(view.line, /ListWidget = function\(/);
	assert.equal(view.selected, "ListWidget");
});

test("limit opens exports.limit in the limit operator's module, read-only", () => {
	const view = readOnly(open("+[limit[2]]", 2)[0]);
	assert.equal(view.title, "$:/core/modules/filters/limit.js");
	assert.match(view.line, /^exports\.limit = function/);
});

test("+ opens the module of the :and run prefix, read-only", () => {
	const view = readOnly(open(" +[limit", 1)[0]);
	assert.equal(view.title, "$:/core/modules/filterrunprefixes/and.js");
	assert.match(view.line, /^exports\.and = function/);
});

test("list-links opens its definition in $:/core/macros/list, read-only", () => {
	const view = readOnly(open("<<list-links", 2)[0]);
	assert.equal(view.title, "$:/core/macros/list");
	assert.match(view.line, /^\\(define|procedure) list-links\(/);
	assert.equal(view.selected, "list-links");
});

test("now opens the run function of the now macro, read-only", () => {
	const view = readOnly(open('<<now "YYYY">>', 2)[0]);
	assert.equal(view.title, "$:/core/modules/macros/now.js");
	assert.match(view.line, /^exports\.run = function/);
	assert.equal(view.selected, "run");
});

// --- Links ---

test('[[LSP Server]], {{LSP Server!!title}} and <$link to="LSP Server"> open LSP/LSP Server.tid', () => {
	const file = features.pathToUri(path.join(helper.DOCS_PATH, "LSP", "LSP Server.tid"));
	[["* [[LSP Server]]", 4], ["{{LSP Server!!title}}", 2], ['<$link to="LSP Server">', 11]].forEach(([snippet, offset]) => {
		assert.deepEqual(open(snippet, offset).map((location) => location.uri), [file], snippet);
	});
});

test("a shadow tiddler, a missing title and a mere mention open nothing", () => {
	[["[[$:/core/ui/PageTemplate]]", 4], ["[[No Such Tiddler]]", 4], ["* LSP Server, merely", 3]].forEach(([snippet, offset]) => {
		assert.deepEqual(open(snippet, offset), [], snippet);
	});
});
