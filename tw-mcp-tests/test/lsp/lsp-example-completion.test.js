"use strict";

/*
Pins LSP Completion - (Example): each row of its table, typed on a new last line
of the Example's own text, gets what the row says. The docs wiki's tiddlers are
loaded (test scaffolding), since the link rows name its titles.

To replicate by hand, boot the test edition (cwd editions/tw-mcp-tests) and run:

  const helper = require("./test/lsp/example-helper");
  const f = $tw.modules.execute("$:/core/modules/commands/inspect/lsp/lsp-features.js");
  helper.loadDocs($tw);
  const example = helper.readExample(f, "LSP Completion - (Example)");
  const typed = helper.typeAtEnd(example.text, "[[lsp ed");
  f.completions(example.uri, typed.text, typed.position).items.map((item) => item.label);
  // -> ["LSP Editor Setup"]
*/

const { test, before, after } = require("node:test");
const assert = require("node:assert");
const { bootTw, loadHandler } = require("../setup");
const helper = require("./example-helper");

const FEATURES_TITLE = "$:/core/modules/commands/inspect/lsp/lsp-features.js";
const EXAMPLE = "LSP Completion - (Example)";
// A title's words, split as LSP Completion describes.
const WORD_SEPARATORS = /[\s_\-/:.]+/;
const PINNED = [
	"[[LS",
	"[[l",
	"[[ed",
	"[[dit",
	"[[LS S",
	"[[lsp ed",
	"[[$:/core/ui/Page",
	"<<lsp.cp",
	'<<lsp.cp.pair a:"1" ',
	'<$transclude $variable="lsp.cp.pair" ',
	"<$li",
	'<$link to="LSP Ser',
	'<$link tooltip="LSP',
	"{{{ [ta",
	"{{{ [<lsp",
	"{{{ [tag[lsp",
	"{{{ [has[cap",
	"{{{ [field:mod",
	"{{{ [prefix[lsp"
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

// The labels offered for a row's entry, typed at the end of the Example.
function labels(entry) {
	helper.positionOf(example.text, "|`" + entry + "` |");
	const typed = helper.typeAtEnd(example.text, entry);
	return features.completions(example.uri, typed.text, typed.position).items.map((item) => item.label);
}

function words(title) {
	return title.toLowerCase().split(WORD_SEPARATORS);
}

test("every row of the Example is pinned here", () => {
	const rows = example.text.split("\n").filter((line) => line.startsWith("|`")).map((line) => /^\|`([^`]*)` \|/.exec(line)[1]);
	assert.deepEqual(rows, PINNED);
});

// --- Link titles ---

test("[[LS lists every title starting with LSP, this one included", () => {
	const found = labels("[[LS");
	assert.ok(found.includes(EXAMPLE), found.join(", "));
	$tw.wiki.filterTiddlers("[!is[system]!has[draft.of]prefix[LSP]]").forEach((title) => {
		assert.ok(found.includes(title), title);
	});
});

test("[[l lists titles starting with l first, then titles with a later word starting with it", () => {
	const found = labels("[[l"),
		starting = found.filter((title) => title.toLowerCase().startsWith("l")),
		later = found.slice(starting.length);
	assert.deepEqual(found.slice(0, starting.length), starting, "no later-word title comes between them");
	assert.ok(starting.length && later.length, found.join(", "));
	later.forEach((title) => {
		assert.ok(words(title).slice(1).some((word) => word.startsWith("l")), title);
	});
});

test("[[ed reaches LSP Editor Setup, because ed starts the word Editor", () => {
	const found = labels("[[ed");
	assert.ok(found.includes("LSP Editor Setup"), found.join(", "));
	found.forEach((title) => {
		assert.ok(words(title).some((word) => word.startsWith("ed")), title);
	});
});

test("[[dit lists nothing: dit sits inside Editor but starts no word", () => {
	assert.deepEqual(labels("[[dit"), []);
});

test("[[LS S reaches LSP Editor Setup and LSP Server: LS starts one word, S another", () => {
	const found = labels("[[LS S");
	assert.ok(found.includes("LSP Editor Setup") && found.includes("LSP Server"), found.join(", "));
	found.forEach((title) => {
		assert.ok(words(title).some((word) => word.startsWith("ls")) && words(title).some((word) => word.startsWith("s")), title);
	});
});

test("[[lsp ed lists LSP Editor Setup alone", () => {
	assert.deepEqual(labels("[[lsp ed"), ["LSP Editor Setup"]);
});

test("[[$:/core/ui/Page reaches shadow tiddlers such as $:/core/ui/PageTemplate, which a plain prefix never reaches", () => {
	assert.ok(labels("[[$:/core/ui/Page").includes("$:/core/ui/PageTemplate"));
	assert.ok($tw.wiki.isShadowTiddler("$:/core/ui/PageTemplate"));
	assert.ok(!$tw.wiki.filterTiddlers("[prefix[$:/core/ui/Page]]").includes("$:/core/ui/PageTemplate"));
});

// --- Names ---

test("<<lsp.cp offers lsp.cp.pair, defined at the top of this tiddler", () => {
	assert.ok(labels("<<lsp.cp").includes("lsp.cp.pair"));
});

test('<<lsp.cp.pair a:"1" offers b:, the one parameter not given', () => {
	assert.deepEqual(labels('<<lsp.cp.pair a:"1" '), ["b:"]);
});

test('<$transclude $variable="lsp.cp.pair" offers a= and b=', () => {
	assert.deepEqual(labels('<$transclude $variable="lsp.cp.pair" '), ["a=", "b="]);
});

test("<$li offers list, and every other widget starting with li", () => {
	const found = labels("<$li");
	assert.ok(found.includes("list"), found.join(", "));
	Object.keys($tw.modules.applyMethods("widget")).filter((name) => name.startsWith("li")).forEach((name) => {
		assert.ok(found.includes(name), name);
	});
});

test('<$link to="LSP Ser offers LSP Server: to takes a title', () => {
	assert.deepEqual(labels('<$link to="LSP Ser'), ["LSP Server"]);
});

test('<$link tooltip="LSP offers nothing: tooltip is text, not a title', () => {
	assert.deepEqual(labels('<$link tooltip="LSP'), []);
});

test("{{{ [ta offers tag, tagging, tags and the other operators starting with ta", () => {
	const found = labels("{{{ [ta");
	assert.ok(["tag", "tagging", "tags"].every((name) => found.includes(name)), found.join(", "));
	Object.keys($tw.wiki.getFilterOperators()).filter((name) => name.startsWith("ta")).forEach((name) => {
		assert.ok(found.includes(name), name);
	});
});

test("{{{ [<lsp offers lsp.cp.pair", () => {
	assert.ok(labels("{{{ [<lsp").includes("lsp.cp.pair"));
});

test("{{{ [tag[lsp offers LSP and every other tag starting with lsp, each with how many tiddlers carry it", () => {
	const typed = helper.typeAtEnd(example.text, "{{{ [tag[lsp"),
		items = features.completions(example.uri, typed.text, typed.position).items,
		tagMap = $tw.wiki.getTagMap();
	helper.positionOf(example.text, "|`{{{ [tag[lsp` |");
	assert.ok(items.some((item) => item.label === "LSP"), items.map((item) => item.label).join(", "));
	Object.keys(tagMap).filter((tag) => tag.toLowerCase().startsWith("lsp")).forEach((tag) => {
		const item = items.find((i) => i.label === tag);
		assert.ok(item, tag);
		assert.equal(item.detail, "tag of " + tagMap[tag].length + (tagMap[tag].length === 1 ? " tiddler" : " tiddlers"));
	});
	assert.ok(items.every((item) => tagMap[item.label]), "only tags");
});

test("{{{ [has[cap offers caption and every other field name starting with cap", () => {
	const found = labels("{{{ [has[cap");
	assert.ok(found.includes("caption"), found.join(", "));
	found.forEach((name) => {
		assert.ok(words(name).some((word) => word.startsWith("cap")), name);
	});
});

test("{{{ [field:mod offers modified: the suffix of field: names a field too", () => {
	assert.ok(labels("{{{ [field:mod").includes("modified"));
});

test("{{{ [prefix[lsp offers nothing: a literal operand is no name", () => {
	assert.deepEqual(labels("{{{ [prefix[lsp"), []);
});
