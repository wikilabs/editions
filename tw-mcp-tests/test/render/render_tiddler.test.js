"use strict";

const { test, before } = require("node:test");
const assert = require("node:assert");
const { bootTw, loadHandler } = require("../setup");

const HANDLER_TITLE = "$:/core/modules/commands/inspect/handlers/render/render_tiddler.js";

let renderTiddler;

before(async () => {
	const $tw = await bootTw();
	renderTiddler = loadHandler($tw, HANDLER_TITLE).render_tiddler;
});

test("render_tiddler: raw mode -> text/plain", () => {
	const result = renderTiddler({
		title: "render_tiddler_text",
		mode: "raw",
		type: "text/plain"
	});
	assert.equal(result.isError, undefined);
	assert.match(result.content[0].text, /Heading One/);
});

test("render_tiddler: raw mode -> text/html includes h1 tag", () => {
	const result = renderTiddler({
		title: "render_tiddler_text",
		mode: "raw",
		type: "text/html"
	});
	assert.equal(result.isError, undefined);
	assert.match(result.content[0].text, /<h1[^>]*>Heading One<\/h1>/);
});

test("render_tiddler: mode default ('raw') still renders", () => {
	const result = renderTiddler({ title: "render_tiddler_caption", type: "text/plain" });
	assert.equal(result.isError, undefined);
	assert.match(result.content[0].text, /Plain body text/);
});

test("render_tiddler: viewtemplate mode renders body via cascade", () => {
	const result = renderTiddler({
		title: "render_tiddler_text",
		mode: "viewtemplate",
		type: "text/plain"
	});
	assert.equal(result.isError, undefined);
	assert.match(result.content[0].text, /Heading One/);
});
