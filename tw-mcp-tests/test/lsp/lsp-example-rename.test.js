"use strict";

/*
Pins LSP Rename - (Example): F2 on each name of its table either changes what the
row says, behind a preview where it says so, or is refused for its reason. Needs
no docs tiddlers.

To replicate by hand, boot the test edition (cwd editions/tw-mcp-tests) and run:

  const helper = require("./test/lsp/example-helper");
  const f = $tw.modules.execute("$:/core/modules/commands/inspect/lsp/lsp-features.js");
  const example = helper.readExample(f, "LSP Rename - (Example)");
  const at = helper.positionOf(example.text, '<<now "YYYY">>', {offset: 2});
  f.rename(example.uri, example.text, at, "later", {annotations: true}, {[example.uri]: example.text});
  // -> {error: "`now` is a JavaScript macro, defined in code."}
*/

const { test, before } = require("node:test");
const assert = require("node:assert");
const { bootTw, loadHandler } = require("../setup");
const helper = require("./example-helper");

const FEATURES_TITLE = "$:/core/modules/commands/inspect/lsp/lsp-features.js";
const EXAMPLE = "LSP Rename - (Example)";
const PINNED = [
	"|`lsp.rn.greet` in the first call |`lsp.rn.hello` |the definition and both calls change |",
	"|`who` in the head of `lsp.rn.greet` |`name` |the preview opens first; the head, `<<who>>` and `who:` in the first call change |",
	"|`word` in the head of `lsp.rn.shout` |`text` |the preview opens; the head and `$word$` change |",
	"|`lsp.rn.greet` |`lsp.rn.shout` |refused: already defined beside it |",
	"|`x` inside the `$let` |anything |refused: a variable a widget sets |",
	"|`currentTiddler` |anything |refused before a new name is asked for |",
	"|`now` |anything |refused: a ~JavaScript macro |",
	"|`list-links` |anything |refused: defined in a shadow tiddler |"
];
const FIRST_CALL = '<<lsp.rn.greet who:"World">>';

let features;
let example;

before(async () => {
	const $tw = await bootTw();
	features = loadHandler($tw, FEATURES_TITLE);
	example = helper.readExample(features, EXAMPLE);
});

function positionIn(snippet, name) {
	return helper.positionOf(example.text, snippet, { offset: snippet.indexOf(name) });
}

function prepare(snippet, name) {
	return features.prepareRename(example.uri, example.text, positionIn(snippet, name), { [example.uri]: example.text });
}

function rename(snippet, name, newName) {
	return features.rename(example.uri, example.text, positionIn(snippet, name), newName, { annotations: true }, { [example.uri]: example.text });
}

// Each edit as where it starts, the text it replaces, its new text and whether it waits for the preview.
function edits(result) {
	assert.equal(result.error, undefined);
	const lines = example.text.split("\n");
	return [].concat(...result.documentChanges.map((change) => {
		assert.equal(change.textDocument.uri, example.uri);
		return change.edits.map((edit) => ({
			at: edit.range.start,
			replaced: lines[edit.range.start.line].slice(edit.range.start.character, edit.range.end.character),
			newText: edit.newText,
			preview: !!(edit.annotationId && result.changeAnnotations[edit.annotationId].needsConfirmation)
		}));
	})).sort((a, b) => a.at.line - b.at.line || a.at.character - b.at.character);
}

function change(snippet, name, newText, preview) {
	return { at: positionIn(snippet, name), replaced: name, newText: newText, preview: preview };
}

test("every row of the table is pinned here", () => {
	const rows = example.text.split("\n").filter((line) => line.startsWith("|`"));
	assert.deepEqual(rows, PINNED);
});

test("lsp.rn.greet in the first call to lsp.rn.hello changes the definition and both calls", () => {
	assert.deepEqual(edits(rename(FIRST_CALL, "lsp.rn.greet", "lsp.rn.hello")), [
		change("\\procedure lsp.rn.greet(who)", "lsp.rn.greet", "lsp.rn.hello", false),
		change(FIRST_CALL, "lsp.rn.greet", "lsp.rn.hello", false),
		change('<<lsp.rn.greet "you">>', "lsp.rn.greet", "lsp.rn.hello", false)
	]);
});

test("who in the head of lsp.rn.greet to name opens the preview first, and changes the head, <<who>> and who: in the first call", () => {
	assert.deepEqual(edits(rename("greet(who)", "who", "name")), [
		change("greet(who)", "who", "name", true),
		change("Hello <<who>>", "who", "name", true),
		change(FIRST_CALL, "who", "name", true)
	]);
});

test("word in the head of lsp.rn.shout to text opens the preview, and changes the head and $word$", () => {
	assert.deepEqual(edits(rename("shout(word)", "word", "text")), [
		change("shout(word)", "word", "text", true),
		change("$word$!", "word", "text", true)
	]);
});

test("lsp.rn.greet to lsp.rn.shout is refused: already defined beside it", () => {
	assert.equal(prepare(FIRST_CALL, "lsp.rn.greet").placeholder, "lsp.rn.greet");
	assert.match(rename(FIRST_CALL, "lsp.rn.greet", "lsp.rn.shout").error, /already defined beside/);
});

test("x inside the $let is refused: a variable a widget sets", () => {
	assert.match(rename("<<x>>", "x", "y").error, /set by <\$let>/);
});

test("currentTiddler is refused before a new name is asked for", () => {
	assert.ok(prepare("<<currentTiddler>>", "currentTiddler").error);
});

test("now is refused: a JavaScript macro", () => {
	assert.match(rename('<<now "YYYY">>', "now", "later").error, /JavaScript macro/);
});

test("list-links is refused: defined in a shadow tiddler", () => {
	assert.match(rename("<<list-links", "list-links", "links").error, /without a file of its own/);
});
