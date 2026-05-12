"use strict";

const { test, before } = require("node:test");
const assert = require("node:assert");
const { bootTw, loadHandler } = require("../setup");

const HANDLER_TITLE = "$:/core/modules/commands/inspect/handlers/render/render_text.js";

let renderText;

before(async () => {
	const $tw = await bootTw();
	renderText = loadHandler($tw, HANDLER_TITLE).render_text;
});

test("render_text: basic wikitext -> text/plain", () => {
	const result = renderText({ text: "Hello ''world''", output: "text/plain" });
	assert.equal(result.isError, undefined);
	assert.match(result.content[0].text, /Hello.*world/);
});

test("render_text: wikitext -> text/html contains tags", () => {
	const result = renderText({ text: "! Heading", output: "text/html" });
	assert.equal(result.isError, undefined);
	assert.match(result.content[0].text, /<h1[^>]*>Heading<\/h1>/);
});

test("render_text: wikitext -> text/plain-formatted preserves block breaks", () => {
	const result = renderText({
		text: "Line one\n\nLine two",
		output: "text/plain-formatted"
	});
	assert.equal(result.isError, undefined);
	assert.match(result.content[0].text, /Line one/);
	assert.match(result.content[0].text, /Line two/);
});

test("render_text: output=parsetree returns JSON tree", () => {
	const result = renderText({ text: "! Heading", output: "parsetree" });
	assert.equal(result.isError, undefined);
	const tree = JSON.parse(result.content[0].text);
	assert.ok(Array.isArray(tree), "parsetree output is an array");
	assert.ok(tree.length > 0, "parsetree has nodes");
});

test("render_text: parsetree with exclude=['start','end'] adds header line", () => {
	const result = renderText({
		text: "Hello",
		output: "parsetree",
		exclude: ["start", "end"]
	});
	assert.equal(result.isError, undefined);
	assert.match(result.content[0].text, /^\(excluded: start, end\)/);
});

test("render_text: parsetree with include=['text'] inlines text", () => {
	const longText = "Hello world this is a longer string";
	const result = renderText({
		text: longText,
		output: "parsetree",
		include: ["text"]
	});
	assert.equal(result.isError, undefined);
	const tree = JSON.parse(result.content[0].text.replace(/^\([^)]*\)\n/, ""));
	const stringified = JSON.stringify(tree);
	assert.ok(stringified.indexOf(longText) !== -1, "full text inlined when include=text");
});

test("render_text: parsetree default elides text via s:N marker", () => {
	const result = renderText({ text: "Hello world long enough", output: "parsetree" });
	assert.equal(result.isError, undefined);
	assert.match(result.content[0].text, /"text":\s*"s:\d+"/);
});

test("render_text: parsetree recurses into attribute objects", () => {
	// A [[Link]] produces a link node with nested attributes object, exercising
	// the compactValue recursion branch.
	const result = renderText({ text: "[[Some target]]", output: "parsetree" });
	assert.equal(result.isError, undefined);
	const stripped = result.content[0].text.replace(/^\([^)]*\)\n/, "");
	const tree = JSON.parse(stripped);
	const json = JSON.stringify(tree);
	assert.match(json, /"attributes"/);
});

test("render_text: parsetree include=['orderedAttributes'] unfolds attr array", () => {
	const result = renderText({
		text: "<div class=\"x\" id=\"y\"/>",
		output: "parsetree",
		include: ["orderedAttributes"]
	});
	assert.equal(result.isError, undefined);
	// When NOT included it appears as "{N attrs}"; with include=orderedAttributes it appears as an array.
	assert.doesNotMatch(result.content[0].text, /orderedAttributes":\s*"\{\d+ attrs\}"/);
});

test("render_text: text over MAX_TEXT_LENGTH -> error", () => {
	const tooLong = "x".repeat(500001);
	const result = renderText({ text: tooLong, output: "text/plain" });
	assert.equal(result.isError, true);
	assert.match(result.content[0].text, /too long/i);
});

// Asserts the contract suggested by the handler's own `if(!rendered) return
// errorResult("No parser for type:")` guard. Probe shows TW's parseText falls
// back to WikiParser for any unrecognised MIME, so a caller passing
// type="application/json" silently gets wikitext parsing. Either the guard is
// dead code or the silent fallback should be surfaced. Filed bead pending.
test.todo("render_text: unknown MIME type should be surfaced (not silently parsed as wikitext)", () => {
	const result = renderText({
		text: "{\"hello\": \"world\"}",
		type: "application/json",
		output: "text/plain"
	});
	assert.equal(result.isError, true,
		"expected unrecognised type to be flagged, got silent fallback");
});
