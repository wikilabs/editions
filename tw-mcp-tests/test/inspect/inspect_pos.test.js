"use strict";

const { test, before } = require("node:test");
const assert = require("node:assert");
const { bootTw, loadHandler } = require("../setup");

const HANDLER_TITLE = "$:/core/modules/commands/inspect/handlers/inspect/inspect_pos.js";

let inspectPos;

before(async () => {
	const $tw = await bootTw();
	inspectPos = loadHandler($tw, HANDLER_TITLE).inspect_pos;
});

test("inspect_pos: basic wikitext produces title index + p= attributes", () => {
	const result = inspectPos({ text: "! Heading", context: "Sample" });
	assert.equal(result.isError, undefined);
	const text = result.content[0].text;
	assert.match(text, /^\[0=Sample\]/);
	assert.match(text, /<h1[^>]*p="0:\d+(-\d+)?"/);
});

test("inspect_pos: default context defaults to '(inline)'", () => {
	const result = inspectPos({ text: "paragraph text" });
	assert.match(result.content[0].text, /^\[0=\(inline\)\]/);
});

test("inspect_pos: link element receives p= attribute", () => {
	const result = inspectPos({ text: "see [[Target]] here", context: "Doc" });
	const text = result.content[0].text;
	assert.match(text, /<a[^>]*p="0:\d+/);
});

test("inspect_pos: transcluded macro adds v= source-variable attribute", () => {
	const result = inspectPos({
		text: "\\procedure hello() Hi there!\n\\end\n\n<<hello>>",
		context: "TestDoc"
	});
	const text = result.content[0].text;
	assert.match(text, /v="hello"/);
});

// Block-mode transclude: the transcluded tiddler should be reached via the
// caller chain on inner DOM elements (c="inspect_pos_macro|Host"). Block mode
// is required: inline transclude (no surrounding blank lines) wraps the
// transclude in a <p> from the calling context, so the inner text has no
// own DOM element to attribute. See the inline-limitation test below.
test("inspect_pos: block transclude propagates source via caller chain", () => {
	const result = inspectPos({
		text: "\n\n<$transclude $tiddler=\"inspect_pos_macro\"/>\n\n",
		context: "Host"
	});
	const text = result.content[0].text;
	assert.match(text, /c="inspect_pos_macro\|Host"/);
	assert.match(text, /v="greet"/);
});

// Inline transclude limitation: when <$transclude $tiddler="X"/> is parsed
// inline (no surrounding blank lines), the parser wraps it in a <p> from the
// calling tiddler. The transcluded content then renders as text nodes inside
// that <p>, so there are no inner DOM elements to attribute back to X. This
// is correct behavior; the <p> truly belongs to the caller.
test("inspect_pos: inline transclude wraps in caller's <p>", () => {
	const result = inspectPos({
		text: "<$transclude $tiddler=\"inspect_pos_macro\"/>",
		context: "Host"
	});
	const text = result.content[0].text;
	assert.match(text, /^\[0=Host\]/);
	assert.doesNotMatch(text, /inspect_pos_macro/);
});

test("inspect_pos: text over MAX_TEXT_LENGTH -> error", () => {
	const result = inspectPos({ text: "x".repeat(500001) });
	assert.equal(result.isError, true);
	assert.match(result.content[0].text, /too long/i);
});
