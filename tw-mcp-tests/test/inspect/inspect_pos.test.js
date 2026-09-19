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

// Line numbers count in the text that was parsed (bead tw-mcp-server-png). By hand:
//   inspect_pos(text=MULTILINE)  ->  the list items carry p="0:3", the link p="0:5"
const MULTILINE = 'one\n\n<$list filter="[[A]] [[B]]"><p>x</p></$list>\n\n[[Target]]';
const HOST = "inspect_pos lines host";

// [titleIndex, line] of the first opening tag matching tagRegExp.
function posOf(output, tagRegExp) {
	const tag = output.match(tagRegExp);
	assert.ok(tag, "no tag matching " + tagRegExp);
	return tag[0].match(/ p="(\d+):(\d+)/).slice(1);
}

test("inspect_pos: inline text reports the lines of the text itself", () => {
	const text = inspectPos({ text: MULTILINE }).content[0].text;
	assert.deepEqual(posOf(text, /<p [^>]*ctx="A"[^>]*>/), ["0", "3"]);
	assert.deepEqual(posOf(text, /<a [^>]*>/), ["0", "5"]);
});

test("inspect_pos: a context tiddler with other text labels the lines, it does not supply them", () => {
	tw.wiki.addTiddler({ title: HOST, tags: "Fixture", text: "unrelated text on one line" });
	try {
		const text = inspectPos({ text: MULTILINE, context: HOST }).content[0].text;
		assert.match(text, /^\[0=inspect_pos lines host\]/);
		assert.deepEqual(posOf(text, /<p [^>]*ctx="A"[^>]*>/), ["0", "3"]);
		assert.deepEqual(posOf(text, /<a [^>]*>/), ["0", "5"]);
	} finally {
		tw.wiki.deleteTiddler(HOST);
	}
});

// Pins the behaviour that was already right: title and tags make a 3-line .tid header.
test("inspect_pos: a context tiddler's own text reports lines in its .tid file", () => {
	tw.wiki.addTiddler({ title: HOST, tags: "Fixture", text: MULTILINE });
	try {
		const text = inspectPos({ text: MULTILINE, context: HOST }).content[0].text;
		assert.deepEqual(posOf(text, /<p [^>]*ctx="A"[^>]*>/), ["0", "6"]);
		assert.deepEqual(posOf(text, /<a [^>]*>/), ["0", "8"]);
	} finally {
		tw.wiki.deleteTiddler(HOST);
	}
});

// A procedure defined in the rendered text points at its body there (bead tw-mcp-server-nlm). By hand:
//   inspect_pos(text=LOCAL_PROC)  ->  [0=(inline)] ... <span c="(inline)" p="0:2" v="hello">
const LOCAL_PROC = "\\procedure hello()\n<span>hi</span>\n\\end\n\n<<hello>>";

test("inspect_pos: a procedure defined in the text points at its body in that text", () => {
	const text = inspectPos({ text: LOCAL_PROC }).content[0].text;
	assert.match(text, /^\[0=\(inline\)\]/);
	assert.deepEqual(posOf(text, /<span [^>]*>/), ["0", "2"]);
	assert.match(text, /<span [^>]*v="hello"/);
});

test("inspect_pos: a procedure defined in a context tiddler's own text points at its file lines", () => {
	tw.wiki.addTiddler({ title: HOST, tags: "Fixture", text: LOCAL_PROC });
	try {
		const text = inspectPos({ text: LOCAL_PROC, context: HOST }).content[0].text;
		assert.match(text, /^\[0=inspect_pos lines host\]/);
		assert.deepEqual(posOf(text, /<span [^>]*>/), ["0", "5"]);
	} finally {
		tw.wiki.deleteTiddler(HOST);
	}
});

// The Inspect Tools example for c=: local procedures keep their names in the chain.
test("inspect_pos: local procedures still name each other in the caller chain", () => {
	const text = inspectPos({
		text: "\\procedure outer() <<inner>>\n\\procedure inner() Inner content.\n<<outer>>",
		context: "caller"
	}).content[0].text;
	assert.match(text, /^\[0=caller\]/);
	assert.match(text, /<p c="outer\|caller" p="0:2" v="inner">Inner content\.<\/p>/);
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

// This edition loads devtools, which holds the shared patches from boot; inspect_pos must not stack a second set (bead tw-mcp-server-5tl).
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

test("inspect_pos: leaves devtools' patches in place", () => {
	const LinkWidget = tw.modules.execute("$:/core/modules/widgets/link.js").link;
	const renderLink = LinkWidget.prototype.renderLink;
	const holders = tw.wikilabsSourcePos.holders;
	inspectPos({ text: "see [[Alpha]] here", context: "Doc" });
	assert.equal(LinkWidget.prototype.renderLink, renderLink);
	assert.equal(tw.wikilabsSourcePos.holders, holders, "devtools still holds the patches after the call");
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
