"use strict";

const { test, before } = require("node:test");
const assert = require("node:assert");
const { bootTw, loadHandler } = require("../setup");

const HANDLER_TITLE = "$:/core/modules/commands/inspect/handlers/render/render_field.js";

let renderField;

before(async () => {
	const $tw = await bootTw();
	renderField = loadHandler($tw, HANDLER_TITLE).render_field;
});

test("render_field: default field 'text' renders tiddler body", () => {
	const result = renderField({ title: "render_field_text", output: "text/plain" });
	assert.equal(result.isError, undefined);
	assert.match(result.content[0].text, /Heading One/);
});

test("render_field: custom field renders to HTML", () => {
	const result = renderField({
		title: "render_field_caption",
		field: "caption",
		output: "text/html"
	});
	assert.equal(result.isError, undefined);
	assert.match(result.content[0].text, /My Custom Caption/);
});

test("render_field: index reads from data tiddler", () => {
	const result = renderField({
		title: "render_field_data",
		index: "key1",
		output: "text/plain"
	});
	assert.equal(result.isError, undefined);
	assert.match(result.content[0].text, /value one/);
});

test("render_field: index missing -> error", () => {
	const result = renderField({
		title: "render_field_data",
		index: "no-such-key"
	});
	assert.equal(result.isError, true);
	assert.match(result.content[0].text, /not found/i);
});

test("render_field: tiddler not found -> error", () => {
	const result = renderField({ title: "DoesNotExist__xyz" });
	assert.equal(result.isError, true);
	assert.match(result.content[0].text, /not found/i);
});

test("render_field: empty/missing field -> error", () => {
	const result = renderField({ title: "render_field_empty", field: "text" });
	assert.equal(result.isError, true);
	assert.match(result.content[0].text, /empty or missing/i);
});
