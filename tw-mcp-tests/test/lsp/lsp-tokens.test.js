"use strict";

/*
Pins semantic tokens (lsp-tokens.js): each name the parse tree can tell apart is
classified by what it means where it is written, which the TextMate grammar
cannot know: a parameter against a global, a core macro against your own, a
filter operator against the field test a misspelt one becomes.

By hand, in a booted test edition:

  const f = $tw.modules.execute("$:/core/modules/commands/inspect/lsp/lsp-features.js");
  f.semanticTokens("file:///x.tid", "title: x\n\n<<now>>\n");
  // -> { data: [2, 2, 3, 1, 2] }: line 2, character 2, length 3, legend type 1 (macro), modifier bit 2 (defaultLibrary)
*/

const { test, before } = require("node:test");
const assert = require("node:assert");
const { bootTw, loadHandler } = require("../setup");

const FEATURES_TITLE = "$:/core/modules/commands/inspect/lsp/lsp-features.js";
const URI = "file:///wiki/tiddlers/lsp_tok.tid";

let features;

before(async () => {
	const $tw = await bootTw();
	features = loadHandler($tw, FEATURES_TITLE);
});

function doc(lines) {
	return "title: lsp_tok\n\n" + lines.join("\n") + "\n";
}

// The tokens of text as [written, type, modifiers], decoded with the legend the server advertises.
function tokens(text, options) {
	const legend = features.SEMANTIC_TOKENS_LEGEND,
		data = features.semanticTokens(URI, text, options).data,
		lines = text.split("\n"),
		found = [];
	let line = 0, character = 0;
	for(let i = 0; i < data.length; i += 5) {
		line += data[i];
		character = data[i] === 0 ? character + data[i + 1] : data[i + 1];
		const modifiers = legend.tokenModifiers.filter((name, bit) => data[i + 4] & (1 << bit));
		found.push([lines[line].slice(character, character + data[i + 2]), legend.tokenTypes[data[i + 3]], modifiers]);
	}
	return found;
}

test("a definition, its parameters and the calls in its body are told apart by what they bind to", () => {
	const text = doc([
		'\\procedure lsp.tok.greet(who, greeting:"Hello")',
		'<$let lsp.tok.local="x"><<greeting>> <<who>> <<lsp.tok.local>> <<currentTiddler>> <<now>> <<lsp.tok.nothing>></$let>',
		'\\end'
	]);
	assert.deepEqual(tokens(text), [
		["lsp.tok.greet", "function", ["declaration"]],
		["who", "parameter", ["declaration"]],
		["greeting", "parameter", ["declaration"]],
		["$let", "class", ["defaultLibrary"]],
		["greeting", "parameter", []],
		["who", "parameter", []],
		["lsp.tok.local", "variable", []],
		["currentTiddler", "variable", ["defaultLibrary"]],
		["now", "macro", ["defaultLibrary"]]
	]);
});

test("outside a definition, a call is what the wiki finds: your own definition, a core one, or nothing", () => {
	const text = doc([
		'\\define lsp.tok.old() x',
		'\\widget $lsp.tok.box() <$slot $name="ts-raw"/>',
		'',
		'<<lsp.tok.old>> <<list-links>> <$lsp.tok.box/> <$lsp.tok.nowidget/> <<lsp.tok.nothing>>'
	]);
	assert.deepEqual(tokens(text), [
		["lsp.tok.old", "macro", ["declaration"]],
		["$lsp.tok.box", "class", ["declaration"]],
		["$slot", "class", ["defaultLibrary"]],
		["lsp.tok.old", "macro", []],
		["list-links", "macro", ["defaultLibrary"]],
		["$lsp.tok.box", "class", []]
	]);
});

test("in a filter, an operator is a method, a name no operator has is the field it tests, and a dotted name is a call", () => {
	const text = doc([
		'\\function lsp.tok.fn() [[a]]',
		'',
		'<$list filter="[tag<lsp.tok.fn>] [caption[x]] [lsp.tok.fn[]]"/>'
	]);
	assert.deepEqual(tokens(text), [
		["lsp.tok.fn", "function", ["declaration"]],
		["$list", "class", ["defaultLibrary"]],
		["tag", "method", ["defaultLibrary"]],
		["lsp.tok.fn", "function", []],
		["caption", "property", []],
		["lsp.tok.fn", "function", []]
	]);
});

test("the client chooses what tokens show: without colors only core names and declarations are sent, untyped", () => {
	const text = doc([
		'\\procedure lsp.tok.p(a) <<a>> <<now>>',
		'',
		'<$list filter="[tag<lsp.tok.p>] [caption[x]]"/>'
	]);
	assert.deepEqual(tokens(text, { colors: false, italic: true, bold: true }), [
		["lsp.tok.p", "tiddlywiki", ["declaration"]],
		["a", "tiddlywiki", ["declaration"]],
		["now", "tiddlywiki", ["defaultLibrary"]],
		["$list", "tiddlywiki", ["defaultLibrary"]],
		["tag", "tiddlywiki", ["defaultLibrary"]]
	]);
	assert.deepEqual(tokens(text, { colors: false, italic: false, bold: true }).map((token) => token[0]), ["lsp.tok.p", "a"]);
});

test("each kind of name is coloured on its own: a kind left out is sent untyped, or not at all with nothing else to show", () => {
	const text = doc([
		'\\procedure lsp.tok.p(a) <<a>> <<lsp.tok.p>>',
		'',
		'<$list filter="[tag<lsp.tok.p>] [caption[x]]" variable="v"><<v>></$list>'
	]);
	assert.deepEqual(tokens(text, { colors: { calls: true, fieldTests: true }, italic: false, bold: true }), [
		["lsp.tok.p", "tiddlywiki", ["declaration"]],
		["a", "tiddlywiki", ["declaration"]],
		["lsp.tok.p", "function", []],
		["$list", "class", []],
		["lsp.tok.p", "function", []],
		["caption", "property", []]
	]);
	assert.deepEqual(tokens(text, { colors: { definitions: true, parameters: true, variables: true, operators: true }, italic: false, bold: false }), [
		["lsp.tok.p", "function", []],
		["a", "parameter", []],
		["a", "parameter", []],
		["tag", "method", []],
		["v", "variable", []]
	]);
});

test("without italic nothing is marked core, without bold nothing is marked a declaration, and with nothing on nothing is sent", () => {
	const text = doc(['\\procedure lsp.tok.p(a) <<a>> <<now>>']),
		modifiers = (options) => [].concat(...tokens(text, options).map((token) => token[2]));
	assert.deepEqual(modifiers({ colors: true, italic: false, bold: true }).filter((name) => name === "defaultLibrary"), []);
	assert.deepEqual(modifiers({ colors: true, italic: true, bold: false }).filter((name) => name === "declaration"), []);
	assert.deepEqual(tokens(text, { colors: false, italic: false, bold: false }), []);
});

test("a document holding no wikitext has no tokens", () => {
	assert.deepEqual(features.semanticTokens(URI, "title: lsp_tok\ntype: application/javascript\n\nvar x = '<<now>>';\n").data, []);
});
