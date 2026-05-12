"use strict";

const { test, before } = require("node:test");
const assert = require("node:assert");
const { bootTw, loadHandler } = require("../setup");

const HANDLER_TITLE = "$:/core/modules/commands/inspect/handlers/query/search_lines.js";

// Scope every search to the search_lines fixture tiddlers so we don't sweep
// the entire wiki (matches in shadow tiddlers would drown the assertions).
const SCOPE = "[prefix[search_lines_]]";

let searchLines;

before(async () => {
	const $tw = await bootTw();
	searchLines = loadHandler($tw, HANDLER_TITLE).search_lines;
});

test("search_lines: literal match in text field", () => {
	const result = searchLines({ pattern: "banana", filter: SCOPE });
	assert.equal(result.isError, undefined);
	const text = result.content[0].text;
	assert.match(text, /search_lines_text/);
	assert.match(text, /banana is on line two/);
	assert.match(text, /1 line matched in 1 tiddler/);
});

test("search_lines: multi-field scan finds matches across tiddlers", () => {
	// Two 'apple' lines in search_lines_text.text + one in search_lines_caption.caption.
	// Exercises both the multi-field branch and the cross-tiddler aggregation.
	const result = searchLines({
		pattern: "apple",
		filter: SCOPE,
		fields: ["text", "caption"]
	});
	const text = result.content[0].text;
	assert.match(text, /3 lines matched in 2 tiddlers/);
});

test("search_lines: case_sensitive=true narrows result", () => {
	const result = searchLines({ pattern: "APPLE", filter: SCOPE, case_sensitive: true });
	assert.equal(result.content[0].text, "(no matches)");
});

test("search_lines: words flag enforces boundary", () => {
	// 'ban' is a substring of 'banana' on line two; words:true should reject it.
	const result = searchLines({ pattern: "ban", filter: SCOPE, words: true });
	assert.equal(result.content[0].text, "(no matches)");
});

test("search_lines: regexp pattern", () => {
	const result = searchLines({ pattern: "^cherry", filter: SCOPE, regexp: true });
	assert.match(result.content[0].text, /cherry is on line three/);
});

test("search_lines: invert returns non-matching lines", () => {
	// Pattern matches lines containing 'apple'; invert returns the others (3 lines).
	const result = searchLines({ pattern: "apple", filter: SCOPE, invert: true });
	const text = result.content[0].text;
	assert.match(text, /banana is on line two/);
	assert.match(text, /cherry is on line three/);
	assert.match(text, /grape is on line five/);
});

test("search_lines: fields=['caption'] searches non-text field", () => {
	const result = searchLines({ pattern: "apple", filter: SCOPE, fields: ["caption"] });
	const text = result.content[0].text;
	assert.match(text, /search_lines_caption/);
	assert.match(text, /caption:L1/);
});

test("search_lines: context=1 emits before+after context lines", () => {
	const result = searchLines({ pattern: "cherry", filter: SCOPE, context: 1 });
	const text = result.content[0].text;
	// '- ' prefix marks context lines.
	assert.match(text, /-.*banana is on line two/);
	assert.match(text, /-.*apple appears again on line four/);
});

test("search_lines: asymmetric context_before / context_after", () => {
	const result = searchLines({
		pattern: "cherry",
		filter: SCOPE,
		context_before: 2,
		context_after: 0
	});
	const text = result.content[0].text;
	assert.match(text, /apple is on line one/);
	assert.match(text, /banana is on line two/);
	assert.doesNotMatch(text, /apple appears again on line four/);
});

test("search_lines: range separator between non-adjacent context blocks", () => {
	// regexp matches lines 1 ('one') and 5 ('five') only; context=1 yields ranges
	// (1,2) and (4,5) — gap between 2 and 4 forces a '--' separator.
	const result = searchLines({
		pattern: "one|five",
		filter: SCOPE,
		regexp: true,
		context: 1
	});
	const text = result.content[0].text;
	assert.match(text, /^\s*--/m);
});

test("search_lines: snippet_cap truncates long lines around the match", () => {
	// 'appears' lives on a 32-char line; cap=20 forces windowSnippet to ellide.
	const result = searchLines({
		pattern: "appears",
		filter: SCOPE,
		snippet_cap: 20
	});
	assert.match(result.content[0].text, /\.\.\./);
});

test("search_lines: max_lines_total cap truncates with footer", () => {
	const result = searchLines({
		pattern: "apple",
		filter: SCOPE,
		max_lines_total: 1
	});
	assert.match(result.content[0].text, /truncated at 1 matches/);
});

test("search_lines: max_lines_per_tiddler cap truncates", () => {
	const result = searchLines({
		pattern: "apple",
		filter: SCOPE,
		max_lines_per_tiddler: 1
	});
	const text = result.content[0].text;
	// One 'apple' match in search_lines_text, the second dropped, then continues into search_lines_caption.
	assert.match(text, /truncated at \d+ matches/);
});

test("search_lines: no matches returns '(no matches)'", () => {
	const result = searchLines({ pattern: "xylophone_definitely_absent", filter: SCOPE });
	assert.equal(result.content[0].text, "(no matches)");
});

test("search_lines: missing pattern -> error", () => {
	const result = searchLines({ filter: SCOPE });
	assert.equal(result.isError, true);
	assert.match(result.content[0].text, /missing required argument/i);
});

test("search_lines: pattern over MAX_FILTER_LENGTH -> error", () => {
	const result = searchLines({ pattern: "x".repeat(10001), filter: SCOPE });
	assert.equal(result.isError, true);
	assert.match(result.content[0].text, /too long/i);
});

test("search_lines: invalid regex -> error", () => {
	const result = searchLines({ pattern: "[(", filter: SCOPE, regexp: true });
	assert.equal(result.isError, true);
	assert.match(result.content[0].text, /invalid regex/i);
});
