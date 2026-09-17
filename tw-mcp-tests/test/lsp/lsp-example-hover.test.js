"use strict";

/*
Pins LSP Hover - (Example): resting on each part it names shows what it says,
checked by the key phrases of the markdown. The docs wiki's tiddlers are loaded
(test scaffolding), since the filters list its tiddlers; the count the Example
states must match the live filter, so a new LSP tiddler fails here until the
Example is updated.

To replicate by hand, boot the test edition (cwd editions/tw-mcp-tests) and run:

  const helper = require("./test/lsp/example-helper");
  const f = $tw.modules.execute("$:/core/modules/commands/inspect/lsp/lsp-features.js");
  helper.loadDocs($tw);
  const example = helper.readExample(f, "LSP Hover - (Example)");
  const at = helper.positionOf(example.text, "<<lsp.outer>> <<lsp.depth>>", {offset: 16});
  f.hover(example.uri, example.text, at, {[example.uri]: example.text}).contents.value;
  // -> "**procedure** `lsp.depth`, defined in this tiddler\n\n| Parameter | Value | Given as |\n...| where | `top` | default |\n"
*/

const { test, before, after } = require("node:test");
const assert = require("node:assert");
const { bootTw, loadHandler } = require("../setup");
const helper = require("./example-helper");

const FEATURES_TITLE = "$:/core/modules/commands/inspect/lsp/lsp-features.js";
const EXAMPLE = "LSP Hover - (Example)";
const PINNED = [
	"|`{{{ [tag[LSP]] }}}` |''5 tiddlers'', named |",
	"|`{{{ [tag[LSP }}}` |''Unfinished filter'', not run |",
	"|`{{{ [tag[a]xyz] }}}` |''Filter error:'' Missing [ in filter expression |",
	"|`{{{ [tag[no-such-tag]] }}}` |''Matches nothing'' |",
	"|`<<lsp.pair a:\"x\" \"y\">>` |''procedure'': `b` is `B` by default, and `y` is listed as ''ignored'' |",
	"|`<<lsp.fpair a:\"x\" \"y\">>` |''function'': `b` is `y`, given by position |",
	"|`<<lsp.depth>>` inside `\\procedure lsp.outer()` |`where`, default `nested` |",
	"|the second call on the line above |`where`, default `top` |",
	"|`tag` in the first filter |''filter operator'' `tag`, its module, its tiddlywiki.com page and its module's description, then the filter's result |",
	"|`is` |''filter operator'' `is`, negated by `!` |",
	"|`:else` |''run prefix'' `:else`: runs only when the output so far is empty |",
	"|`+` |''run prefix'' `+`, short for `:and` |",
	"|`toc-link` in the second filter |''Not a filter operator'': the field test `[field:toc-link[no]]` instead |",
	"|`\\function` in the first line of this tiddler |what the keyword does |",
	"|`lsp.pair` in its `\\procedure` line |''procedure'' `lsp.pair`, defined here, local to this tiddler, with its parameters, defaults and call count |",
	"|`b` in `lsp.pair(a:\"A\", b:\"B\")` |''parameter'' `b` of `lsp.pair`, default `B`, named once in its body |",
	"|`\\procedure` in the line below |''Not a definition here'': after text, it is text |"
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

// The hover markdown at offset into the first occurrence of snippet.
function hoverAt(snippet, offset) {
	const at = helper.positionOf(example.text, snippet, { offset: offset }),
		result = features.hover(example.uri, example.text, at, { [example.uri]: example.text });
	assert.ok(result, "no hover at " + JSON.stringify(snippet));
	return result.contents.value;
}

function assertShows(value, phrases) {
	phrases.forEach((phrase) => assert.ok(value.includes(phrase), "expected " + JSON.stringify(phrase) + " in:\n" + value));
}

function count(filter) {
	return "**" + $tw.wiki.filterTiddlers(filter).length + " tiddlers**";
}

test("every row of the tables is pinned here", () => {
	const rows = example.text.split("\n").filter((line) => line.startsWith("|") && !line.startsWith("|!"));
	assert.deepEqual(rows, PINNED);
});

// --- A filter, and the four outcomes ---

test("the filter written three ways reports the same tiddlers each time, named", () => {
	const titles = $tw.wiki.filterTiddlers("[tag[LSP]]");
	assert.equal(/each reports the same (\d+) tiddlers/.exec(example.text)[1], String(titles.length), "the count the Example states");
	assert.equal(/''(\d+) tiddlers'', named/.exec(example.text)[1], String(titles.length), "the count its table states");
	[["\n{{{ [tag[LSP]] }}}\n", 6], ['<$list filter="[tag[LSP]]">', 16], ["\\function lsp.pages() [tag[LSP]]", 23]].forEach(([snippet, offset]) => {
		assertShows(hoverAt(snippet, offset), [count("[tag[LSP]]")].concat(titles.map((title) => "[" + title + "](")));
	});
});

test("{{{ [tag[LSP }}} is an unfinished filter, not run", () => {
	assertShows(hoverAt("\n{{{ [tag[LSP }}}\n", 6), ["Unfinished filter", "has not been run"]);
});

test("{{{ [tag[a]xyz] }}} shows the filter error", () => {
	assertShows(hoverAt("\n{{{ [tag[a]xyz] }}}\n", 6), ["**Filter error:** Missing [ in filter expression"]);
});

test("{{{ [tag[no-such-tag]] }}} matches nothing", () => {
	assertShows(hoverAt("\n{{{ [tag[no-such-tag]] }}}\n", 6), ["Matches nothing"]);
});

// --- A widget, a macro call ---

test("<$list shows the widget, the module defining it, each attribute and what it renders", () => {
	assertShows(hoverAt('<$list filter="[tag[LSP]]">', 2), ["**widget** `$list`", "`$:/core/modules/widgets/list.js`", "| filter | `[tag[LSP]]` |", "**Renders as**"]);
});

test("list-links shows where it is defined, what each parameter is worth here and the tiddlers its filter lists", () => {
	assertShows(hoverAt("<<list-links [tag[LSP]]>>", 2), [
		"**macro** `list-links`, defined in `$:/core/macros/list`",
		"| filter | `[tag[LSP]]` | positional |",
		"| type | `ul` | default |",
		count("[tag[LSP]]")
	]);
});

// --- How arguments bind, a nested definition ---

test('<<lsp.pair a:"x" "y">> is a procedure: b is B by default, and y is ignored', () => {
	assertShows(hoverAt('\n<<lsp.pair a:"x" "y">>', 3), ["**procedure** `lsp.pair`", "| b | `B` | default |", "|  | `y` | ignored |"]);
});

test('<<lsp.fpair a:"x" "y">> is a function: b is y, given by position', () => {
	assertShows(hoverAt('\n<<lsp.fpair a:"x" "y">>', 3), ["**function** `lsp.fpair`", "| b | `y` | positional |"]);
});

test("<<lsp.depth>> inside lsp.outer has where nested by default, the call beside <<lsp.outer>> has where top", () => {
	assertShows(hoverAt("\t<<lsp.depth>>", 3), ["| where | `nested` | default |"]);
	assertShows(hoverAt("<<lsp.outer>> <<lsp.depth>>", 16), ["| where | `top` | default |"]);
});

// --- Operators and run prefixes ---

test("tag in the first filter shows the operator, its module, its tiddlywiki.com page and its module's description, then the filter's result", () => {
	const value = hoverAt("{{{ [tag[LSP Capabilities]!is[system]]", 5),
		result = count("[tag[LSP Capabilities]!is[system]] :else[[none]] +[limit[3]]"),
		description = "> Filter operator for checking for the presence of a tag";
	assertShows(value, ["**filter operator** `tag`", "`$:/core/modules/filters/tag.js`", "https://tiddlywiki.com/#tag%20Operator", description, result]);
	assert.ok(value.indexOf("tiddlywiki.com") < value.indexOf(description) && value.indexOf(description) < value.indexOf(result), "the description comes after the operator, the result after both");
});

test("is shows the operator, negated by !", () => {
	assertShows(hoverAt("!is[system]", 1), ["**filter operator** `is`, negated by `!`"]);
});

test(":else shows the run prefix, which runs only when the output so far is empty", () => {
	assertShows(hoverAt(":else[[none]]", 1), ["**run prefix** `:else`: runs only when the output so far is empty"]);
});

test("+ shows the run prefix, short for :and", () => {
	assertShows(hoverAt(" +[limit[3]]", 1), ["**run prefix** `+`, short for `:and`"]);
});

test("toc-link in the second filter is not a filter operator, but the field test [field:toc-link[no]]", () => {
	assertShows(hoverAt("toc-link[no]", 0), ["**Not a filter operator.**", "`[field:toc-link[no]]`"]);
});

// --- Pragma lines ---

test("\\function in the first line shows what the keyword does", () => {
	assertShows(hoverAt("\\function lsp.pages", 1), ["```\n\\function\n```", "Defines a function"]);
});

test("lsp.pair in its \\procedure line shows the procedure, defined here, local, with parameters, defaults and call count", () => {
	assertShows(hoverAt("\\procedure lsp.pair(", 11), [
		"**procedure** `lsp.pair`, defined here, local to this tiddler",
		"| a | `A` |",
		"| b | `B` |",
		"1 call of this name"
	]);
});

test('b in lsp.pair(a:"A", b:"B") shows the parameter, default B, named once in its body', () => {
	assertShows(hoverAt('b:"B") a=', 0), ["**parameter** `b` of `lsp.pair`, default `B`", "Named 1 time in its body"]);
});

test("\\procedure after text is not a definition here", () => {
	assertShows(hoverAt("\n\\procedure lsp.late", 2), ["**Not a definition here:**"]);
});
