"use strict";

const { test, before } = require("node:test");
const assert = require("node:assert");
const { bootTw, loadHandler } = require("../setup");

const HANDLER_TITLE = "$:/core/modules/commands/inspect/handlers/inspect/inspect_pos.js";

let inspectPos;
let tw;

before(async () => {
	tw = await bootTw();
	inspectPos = loadHandler(tw, HANDLER_TITLE).inspect_pos;
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

// The widget patches now come from devtools alone (bead tw-mcp-server-bay).
// While inspect_pos carried its own copy on top of devtools', every rendered
// node was announced twice: the same attribute written twice, so the output
// never showed it and only a hook count could.
test("inspect_pos: each node is announced to the hooks exactly once", () => {
	let links = 0;
	const countLinks = (domNode) => { links++; return domNode; };
	tw.hooks.addHook("th-dom-rendering-link", countLinks);
	try {
		inspectPos({ text: "one [[Alpha]] and two [[Beta]] links", context: "Doc" });
	} finally {
		tw.hooks.removeHook("th-dom-rendering-link", countLinks);
	}
	assert.equal(links, 2, "two links in the text, so two announcements");
});

// The plugin used to ship this switched on, so merely installing devtools put
// tooltips and a context menu in front of everyone who did not want them.
test("devtools ships source-position tracking switched off", () => {
	assert.equal(tw.wiki.getTiddlerText("$:/config/wikilabs/SourcePositionTracking", "").trim(), "no");
	assert.ok(!tw.wiki.trackSourcePositions, "nothing should be tracking until a user asks for it");
});

// devtools is a declared dependent, but nothing stops a wiki being assembled
// without it. Requiring it at load time aborted the whole tool map, because a
// missing module exits the process on node — so every other tool went down
// with inspect_pos. It must degrade to an error a user can act on instead.
test("inspect_pos: without devtools it reports why, rather than taking the server down", () => {
	const DEVTOOLS_UTILS = "$:/plugins/wikilabs/devtools/utils.js";
	const registered = tw.modules.titles[DEVTOOLS_UTILS];
	assert.ok(registered, "this edition must load devtools, or the test proves nothing");
	delete tw.modules.titles[DEVTOOLS_UTILS];
	try {
		const result = inspectPos({ text: "a [[Link]]", context: "Doc" });
		assert.equal(result.isError, true);
		assert.match(result.content[0].text, /devtools/, "the message must name the plugin to add");
	} finally {
		tw.modules.titles[DEVTOOLS_UTILS] = registered;
	}
	// And it works again once devtools is back.
	assert.equal(inspectPos({ text: "a [[Link]]", context: "Doc" }).isError, undefined);
});

test("inspect_pos: a call leaves source-position tracking as it found it", () => {
	// devtools lets a user switch tracking on; a tool call must not switch it
	// off again behind their back.
	const before = tw.wiki.trackSourcePositions;
	tw.wiki.trackSourcePositions = true;
	try {
		inspectPos({ text: "some [[Link]] text", context: "Doc" });
		assert.equal(tw.wiki.trackSourcePositions, true, "tracking the user turned on must survive the call");
	} finally {
		tw.wiki.trackSourcePositions = before;
	}
});
