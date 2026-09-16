"use strict";

/*
Pins LSP Signature Help - (Example): each row of its table, typed on a new last
line of the Example, pops up the signature it names with the parameter it names
marked. Needs no docs tiddlers; now is the core's JavaScript macro.

To replicate by hand, boot the test edition (cwd editions/tw-mcp-tests) and run:

  const helper = require("./test/lsp/example-helper");
  const f = $tw.modules.execute("$:/core/modules/commands/inspect/lsp/lsp-features.js");
  const example = helper.readExample(f, "LSP Signature Help - (Example)");
  const typed = helper.typeAtEnd(example.text, '<<lsp.sh.pair a:"1" ');
  const help = f.signatureHelp(example.uri, typed.text, typed.position);
  [help.signatures[0].label, help.activeParameter];
  // -> ['lsp.sh.pair(a, b:"B", c)', 1]
*/

const { test, before } = require("node:test");
const assert = require("node:assert");
const { bootTw, loadHandler } = require("../setup");
const helper = require("./example-helper");

const FEATURES_TITLE = "$:/core/modules/commands/inspect/lsp/lsp-features.js";
const EXAMPLE = "LSP Signature Help - (Example)";
const PAIR = 'lsp.sh.pair(a, b:"B", c)';
const ROWS = [
	{ entry: "<<lsp.sh.pair ", popup: PAIR, marked: "a" },
	{ entry: '<<lsp.sh.pair a:"1" ', popup: PAIR, marked: "b" },
	{ entry: "<<lsp.sh.pair c:", popup: PAIR, marked: "c" },
	{ entry: '<<lsp.sh.pair "1" "', popup: PAIR, marked: "b" },
	{ entry: '<<lsp.sh.macro a:"1" "', popup: "lsp.sh.macro(a, b)", marked: "b" },
	{ entry: '<$transclude $variable="lsp.sh.pair" a="1" ', popup: PAIR, marked: "b" },
	{ entry: "{{{ [lsp.sh.fn[1],[", popup: "lsp.sh.fn(a, b)", marked: "b" },
	{ entry: '<<lsp.sh.pair zz:"1" ', popup: PAIR, marked: "a" },
	{ entry: "<<now ", popup: "now(format)", marked: "format" }
];

let features;
let example;

before(async () => {
	const $tw = await bootTw();
	features = loadHandler($tw, FEATURES_TITLE);
	example = helper.readExample(features, EXAMPLE);
});

// The popup for a row's entry, typed at the end of the Example: its label, the marked parameter's name and its note.
function popup(entry) {
	const typed = helper.typeAtEnd(example.text, entry),
		help = features.signatureHelp(example.uri, typed.text, typed.position),
		signature = help.signatures[help.activeSignature],
		range = signature.parameters[help.activeParameter].label;
	return {
		popup: signature.label,
		marked: signature.label.slice(range[0], range[1]).replace(/:.*$/, ""),
		documentation: signature.documentation.value
	};
}

test("every row of the table is pinned here", () => {
	const entries = example.text.split("\n").filter((line) => line.startsWith("|`")).map((line) => /^\|`([^`]*)` \|/.exec(line)[1]);
	assert.deepEqual(entries, ROWS.map((row) => row.entry));
});

ROWS.forEach((row) => {
	test(row.entry.trim() + " pops up " + row.popup + " with " + row.marked + " marked", () => {
		const found = popup(row.entry);
		assert.deepEqual({ popup: found.popup, marked: found.marked }, { popup: row.popup, marked: row.marked });
	});
});

test('<<lsp.sh.pair zz:"1" notes that zz is not declared', () => {
	assert.match(popup('<<lsp.sh.pair zz:"1" ').documentation, /Not declared by this definition: `zz`/);
	assert.doesNotMatch(popup('<<lsp.sh.pair a:"1" ').documentation, /Not declared/);
});
