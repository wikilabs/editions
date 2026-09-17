"use strict";

/*
Pins LSP Diagnostics - (Example): of its four lines only the first is warned, a
link to a missing title added on a new line is warned too, the two calls nothing
defines get a hint with the quick fix the Example names, <<actionValue>> gets
none, and listing undefined calls and widgets reports both names. The docs
wiki's tiddlers are loaded (test scaffolding), since LSP Server has to resolve.

To replicate by hand, boot the test edition (cwd editions/tw-mcp-tests) and run:

  const helper = require("./test/lsp/example-helper");
  const f = $tw.modules.execute("$:/core/modules/commands/inspect/lsp/lsp-features.js");
  helper.loadDocs($tw);
  const example = helper.readExample(f, "LSP Diagnostics - (Example)");
  f.diagnostics(example.uri, example.text).map((d) => d.message);
  // -> ["No tiddler titled 'No Such Tiddler'", "`lsp.dg.gret` is not defined or set anywhere in this wiki",
  //     "`$lisst` is no widget, and no \\widget in this wiki defines it"]
*/

const { test, before, after } = require("node:test");
const assert = require("node:assert");
const { bootTw, loadHandler } = require("../setup");
const helper = require("./example-helper");

const FEATURES_TITLE = "$:/core/modules/commands/inspect/lsp/lsp-features.js";
const EXAMPLE = "LSP Diagnostics - (Example)";
const WARNING = 2;
const INFORMATION = 3;
const HINT = 4;
const FOUR_LINES = [
	"See [[No Such Tiddler]].",
	"See [[LSP Server]].",
	"Code `[[No Such Tiddler]]` here.",
	"See [[docs|https://tiddlywiki.com]]."
];
const GRET_MESSAGE = "`lsp.dg.gret` is not defined or set anywhere in this wiki";
const LISST_MESSAGE = "`$lisst` is no widget, and no \\widget in this wiki defines it";
const TAGG_MESSAGE = "`tagg` is no filter operator, so TiddlyWiki tests a field of that name";

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

// The diagnostics of one severity as the editor shows them: where, how severe, what they say.
function shown(text, severity) {
	return features.diagnostics(example.uri, text)
		.filter((d) => d.severity === severity)
		.map((d) => ({ range: d.range, severity: d.severity, message: d.message }));
}

// The range of name inside the first occurrence of line.
function rangeOf(text, line, name) {
	const start = helper.positionOf(text, line, { offset: line.indexOf(name) });
	return { start: start, end: { line: start.line, character: start.character + name.length } };
}

test("only the first of the four lines is warned, as No tiddler titled 'No Such Tiddler'", () => {
	FOUR_LINES.forEach((line) => helper.positionOf(example.text, "\n" + line + "\n"));
	assert.deepEqual(shown(example.text, WARNING), [{
		range: rangeOf(example.text, FOUR_LINES[0], "No Such Tiddler"),
		severity: WARNING,
		message: "No tiddler titled 'No Such Tiddler'"
	}]);
});

test("a link of your own to a title that does not exist is warned", () => {
	const typed = helper.typeAtEnd(example.text, "See [[Nowhere Yet]].");
	assert.deepEqual(shown(typed.text, WARNING).slice(1), [{
		range: rangeOf(typed.text, "See [[Nowhere Yet]].", "Nowhere Yet"),
		severity: WARNING,
		message: "No tiddler titled 'Nowhere Yet'"
	}]);
});

// The hints on calls, leaving out those on filter steps.
function callHints(text) {
	return shown(text, HINT).filter((d) => d.message !== TAGG_MESSAGE);
}

test("the two calls nothing defines get a hint each, and <<actionValue>> gets none", () => {
	helper.positionOf(example.text, "<<actionValue>>");
	assert.deepEqual(callHints(example.text), [
		{ range: rangeOf(example.text, "\n<<lsp.dg.gret>>\n", "lsp.dg.gret"), severity: HINT, message: GRET_MESSAGE },
		{ range: rangeOf(example.text, '\n<$lisst filter="[tag[LSP]]"/>\n', "$lisst"), severity: HINT, message: LISST_MESSAGE }
	]);
});

test("Ctrl+. offers Change to lsp.dg.greet and Change to $list", () => {
	callHints(example.text).forEach((hint, index) => {
		const actions = features.codeActions(example.uri, example.text, hint.range, { diagnostics: [hint] });
		assert.equal(actions[0].title, ["Change to lsp.dg.greet", "Change to $list"][index]);
	});
});

test("tagg in a filter gets a hint and Change to tag, and a field test on purpose gets none", () => {
	const line = '\n<$list filter="[tagg[LSP]]"/>\n',
		hints = shown(example.text, HINT).filter((d) => d.message === TAGG_MESSAGE);
	helper.positionOf(example.text, '<$list filter="[caption[LSP]] [toc-link[no]]"/>');
	assert.deepEqual(hints, [{ range: rangeOf(example.text, line, "tagg"), severity: HINT, message: TAGG_MESSAGE }]);
	assert.equal(features.codeActions(example.uri, example.text, hints[0].range, { diagnostics: hints })[0].title, "Change to tag");
});

test("listing undefined calls and widgets reports both names of this tiddler as information", () => {
	const entry = features.listUndefinedCalls({}).find((e) => e.uri === example.uri);
	assert.deepEqual(entry.diagnostics.map((d) => ({ severity: d.severity, message: d.message })), [
		{ severity: INFORMATION, message: GRET_MESSAGE },
		{ severity: INFORMATION, message: LISST_MESSAGE }
	]);
});
