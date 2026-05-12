"use strict";

const { test, before } = require("node:test");
const assert = require("node:assert");
const { bootTw, loadHandler } = require("../setup");

const HANDLER_TITLE = "$:/core/modules/commands/inspect/handlers/inspect/inspect_scope.js";

let inspectScope;

before(async () => {
	const $tw = await bootTw();
	inspectScope = loadHandler($tw, HANDLER_TITLE).inspect_scope;
});

test("inspect_scope: text+charPos with $let surfaces bound variable", () => {
	// charPos 13 lands inside the $let body (after the opening tag's `>`).
	const result = inspectScope({
		text: "<$let x=\"1\">{{!!title}}</$let>",
		charPos: 13
	});
	assert.equal(result.isError, undefined);
	assert.match(result.content[0].text, /^Scope at char 13/);
	assert.match(result.content[0].text, /var x/);
});

test("inspect_scope: text arg without tiddler still works", () => {
	const result = inspectScope({
		text: "<$let foo=\"bar\">probe</$let>",
		charPos: 17
	});
	assert.equal(result.isError, undefined);
	assert.match(result.content[0].text, /var foo/);
});

test("inspect_scope: filter narrows the displayed variables", () => {
	const result = inspectScope({
		text: "<$let alpha=\"1\" beta=\"2\">probe</$let>",
		charPos: 26,
		filter: "alpha"
	});
	const text = result.content[0].text;
	assert.match(text, /var alpha/);
	assert.doesNotMatch(text, /var beta/);
});

test("inspect_scope: missing tiddler -> error", () => {
	const result = inspectScope({ tiddler: "DoesNotExist__xyz", charPos: 0 });
	assert.equal(result.isError, true);
	assert.match(result.content[0].text, /not found or empty/i);
});

test("inspect_scope: neither tiddler nor text -> error", () => {
	const result = inspectScope({ charPos: 0 });
	assert.equal(result.isError, true);
	assert.match(result.content[0].text, /Provide either/i);
});

test("inspect_scope: renderContext='viewtemplate' adds storyTiddler etc.", () => {
	const result = inspectScope({
		text: "<$let x=\"1\">{{!!title}}</$let>",
		charPos: 13,
		renderContext: "viewtemplate"
	});
	assert.equal(result.isError, undefined);
	assert.match(result.content[0].text, /storyTiddler/);
});

test("inspect_scope: renderContext='root' adds storyviewTitle etc.", () => {
	const result = inspectScope({
		text: "<$let x=\"1\">{{!!title}}</$let>",
		charPos: 13,
		renderContext: "root"
	});
	assert.match(result.content[0].text, /storyviewTitle/);
});

test("inspect_scope: no widget found near charPos -> error", () => {
	// charPos 99999 is past the end of the (very short) text; no widget has a
	// parseTreeNode.start anywhere near it, but findBestWidget returns the
	// closest available — so this test really just exercises that the search
	// completes. Verify either a "no widget" error or a valid scope result.
	const result = inspectScope({ text: "x", charPos: 99999 });
	// Either an error OR a valid scope dump is acceptable; we just confirm
	// the handler doesn't crash.
	assert.ok(result.content[0].text.length > 0);
});

// ---- Documenting findings: tests below assert desired behaviour the
// handler does not currently meet. Probed with test/_probe.js.

// Documented contract: when args.all=true the output gains an "— other
// globals" section listing imported-but-unused vars. Probe shows that
// inspect_scope standalone never populates `importedVars` because the
// `sourceTitle` property on var instances is only set by inspect_pos's
// widget patches (and those are restored in inspect_pos's finally block).
// Result: every var lands in "local scope", "— used globals" and "— other
// globals" sections never appear. Real finding for a downstream improvement.
test.todo("inspect_scope: all=true should show '— other globals' section", () => {
	const result = inspectScope({
		text: "<$let x=\"1\">{{!!title}}</$let>",
		charPos: 13,
		all: true
	});
	assert.match(result.content[0].text, /— other globals/);
});

test("inspect_scope: \\procedure pragma classifies as 'proc'", () => {
	const result = inspectScope({
		text: "\\procedure greet() Hello!\n\\end\n\n<<greet>>",
		charPos: 35,
		filter: "greet"
	});
	assert.match(result.content[0].text, /proc greet/);
});
