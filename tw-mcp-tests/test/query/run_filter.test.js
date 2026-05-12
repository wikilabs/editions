"use strict";

const { test, before } = require("node:test");
const assert = require("node:assert");
const { bootTw, loadHandler } = require("../setup");

const HANDLER_TITLE = "$:/core/modules/commands/inspect/handlers/query/run_filter.js";

let runFilter;

before(async () => {
	const $tw = await bootTw();
	runFilter = loadHandler($tw, HANDLER_TITLE).run_filter;
});

test("run_filter: tag filter returns matching title", () => {
	const result = runFilter({ filter: "[tag[query_test_tag]]" });
	assert.equal(result.isError, undefined);
	assert.equal(result.content[0].text, "run_filter_tagged");
});

test("run_filter: no matches returns '(no results)'", () => {
	const result = runFilter({ filter: "[tag[no_such_tag_at_all]]" });
	assert.equal(result.isError, undefined);
	assert.equal(result.content[0].text, "(no results)");
});

test("run_filter: large result set truncates at 500 with footer", () => {
	// [all[shadows+tiddlers]] returns 2k+ entries on this edition.
	const result = runFilter({ filter: "[all[shadows+tiddlers]]" });
	assert.equal(result.isError, undefined);
	assert.match(result.content[0].text, /\(\d+ total, showing first 500\)/);
});

test("run_filter: filter over MAX_FILTER_LENGTH -> error", () => {
	const tooLong = "[" + "a".repeat(10001) + "]";
	const result = runFilter({ filter: tooLong });
	assert.equal(result.isError, true);
	assert.match(result.content[0].text, /too long/i);
});
