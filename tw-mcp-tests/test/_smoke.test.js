"use strict";

const { test, before } = require("node:test");
const assert = require("node:assert");
const { bootTw, loadHandler } = require("./setup");

let $tw;

before(async () => {
	$tw = await bootTw();
});

test("TW boots with tw-mcp plugin", () => {
	assert.ok($tw, "$tw is defined");
	assert.ok($tw.wiki, "$tw.wiki exists");
	const plugin = $tw.wiki.getTiddler("$:/plugins/wikilabs/tw-mcp");
	assert.ok(plugin, "tw-mcp plugin tiddler loaded");
});

test("fixture tiddlers loaded (render category)", () => {
	assert.ok($tw.wiki.getTiddler("render_field_text"));
	assert.ok($tw.wiki.getTiddler("render_field_caption"));
	assert.ok($tw.wiki.getTiddler("render_field_data"));
	assert.ok($tw.wiki.getTiddler("render_field_empty"));
	assert.ok($tw.wiki.getTiddler("render_tiddler_text"));
	assert.ok($tw.wiki.getTiddler("render_tiddler_caption"));
});

test("fixture tiddlers loaded (query category)", () => {
	assert.ok($tw.wiki.getTiddler("run_filter_tagged"));
	assert.ok($tw.wiki.getTiddler("list_tiddlers_a"));
	assert.ok($tw.wiki.getTiddler("list_tiddlers_b"));
	assert.ok($tw.wiki.getTiddler("search_lines_text"));
	assert.ok($tw.wiki.getTiddler("search_lines_caption"));
});

test("loadHandler returns render_text export", () => {
	const mod = loadHandler($tw, "$:/core/modules/commands/inspect/handlers/render/render_text.js");
	assert.equal(typeof mod.render_text, "function");
});
