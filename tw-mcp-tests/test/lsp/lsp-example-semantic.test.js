"use strict";

/*
Pins LSP Semantic Tokens - (Example): each name its table points at is sent with
the type and modifier the row states. Needs no docs tiddlers.

To replicate by hand, boot the test edition (cwd editions/tw-mcp-tests) and run:

  const helper = require("./test/lsp/example-helper");
  const f = $tw.modules.execute("$:/core/modules/commands/inspect/lsp/lsp-features.js");
  const example = helper.readExample(f, "LSP Semantic Tokens - (Example)");
  f.semanticTokens(example.uri, example.text).data.slice(0, 5);
  // -> [5, 11, 12, 0, 1]: line 5 (after the file's header), character 11, lsp.st.greet, type function, modifier declaration
*/

const { test, before } = require("node:test");
const assert = require("node:assert");
const { bootTw, loadHandler } = require("../setup");
const helper = require("./example-helper");

const FEATURES_TITLE = "$:/core/modules/commands/inspect/lsp/lsp-features.js";
const EXAMPLE = "LSP Semantic Tokens - (Example)";
const PINNED = [
	"|`lsp.st.greet` in the first line |''function'', declaration: bold |",
	"|`who` in the first line |''parameter'', declaration: bold |",
	"|`<<who>>` in the second line |''parameter'' |",
	"|`<<lsp.st.mood>>` |''variable'' |",
	"|`<<now>>` |''macro'', core: italic |",
	"|`<<lsp.st.greet` below the text |''function'' |",
	"|`$list` |''class'', core: italic |",
	"|`tag` and `limit` |''method'', core: italic |",
	"|`caption` |''property'': no operator has that name, so ~TiddlyWiki tests the field |",
	"|`<<lsp.st.item>>` |''variable'' |"
];

let features;
let example;
let sent;

before(async () => {
	const $tw = await bootTw();
	features = loadHandler($tw, FEATURES_TITLE);
	example = helper.readExample(features, EXAMPLE);
	sent = decode(features.semanticTokens(example.uri, example.text).data);
});

// Every token as { line, character, length, type, modifiers }.
function decode(data) {
	const legend = features.SEMANTIC_TOKENS_LEGEND,
		found = [];
	let line = 0, character = 0;
	for(let i = 0; i < data.length; i += 5) {
		line += data[i];
		character = data[i] === 0 ? character + data[i + 1] : data[i + 1];
		found.push({ line, character, length: data[i + 2], type: legend.tokenTypes[data[i + 3]], modifiers: legend.tokenModifiers.filter((name, bit) => data[i + 4] & (1 << bit)) });
	}
	return found;
}

// The token at offset characters into the first occurrence of snippet, as [type, modifiers].
function tokenAt(snippet, offset) {
	const at = helper.positionOf(example.text, snippet, { offset: offset }),
		token = sent.find((t) => t.line === at.line && t.character === at.character);
	assert.ok(token, "no token at " + JSON.stringify(snippet) + " + " + offset);
	return [token.type, token.modifiers];
}

test("every row of the table is pinned here", () => {
	assert.deepEqual(example.text.split("\n").filter((line) => line.startsWith("|") && !line.startsWith("|!")), PINNED);
});

test("the definition's name and its parameter are declarations", () => {
	assert.deepEqual(tokenAt("\\procedure lsp.st.greet(who)", 11), ["function", ["declaration"]]);
	assert.deepEqual(tokenAt("\\procedure lsp.st.greet(who)", 24), ["parameter", ["declaration"]]);
});

test("inside the body, who is the parameter, lsp.st.mood the variable, now a core macro", () => {
	assert.deepEqual(tokenAt("Hello <<who>>", 8), ["parameter", []]);
	assert.deepEqual(tokenAt("<<lsp.st.mood>> at", 2), ["variable", []]);
	assert.deepEqual(tokenAt("<<now>></$let>", 2), ["macro", ["defaultLibrary"]]);
});

test("below the text, the call is a function, $list a core widget, tag and limit core operators, caption a field test, and the list variable a variable", () => {
	assert.deepEqual(tokenAt('<<lsp.st.greet who:"you">>', 2), ["function", []]);
	assert.deepEqual(tokenAt("<$list filter=", 1), ["class", ["defaultLibrary"]]);
	assert.deepEqual(tokenAt("[tag[LSP Capabilities]", 1), ["method", ["defaultLibrary"]]);
	assert.deepEqual(tokenAt("limit[1]]", 0), ["method", ["defaultLibrary"]]);
	assert.deepEqual(tokenAt("[caption[x]]", 1), ["property", []]);
	assert.deepEqual(tokenAt("<<lsp.st.item>></$list>", 2), ["variable", []]);
});
