"use strict";

const { test, before } = require("node:test");
const assert = require("node:assert");
const { bootTw, loadHandler } = require("../setup");

const HANDLER_TITLE = "$:/core/modules/commands/inspect/handlers/filesystem.js";

let uploadFile;

before(async () => {
	const $tw = await bootTw();
	uploadFile = loadHandler($tw, HANDLER_TITLE).upload_file;
});

test("upload_file: missing data -> error", () => {
	const result = uploadFile({ filename: "x.txt" });
	assert.equal(result.isError, true);
	assert.match(result.content[0].text, /base64-encoded string/);
});

test("upload_file: base64 payload over 50 MB -> error before allocation", () => {
	// Just over the base64 length cap; we never actually allocate the buffer
	// because the handler checks args.data.length first.
	const cap = Math.ceil((50 * 1024 * 1024) / 3) * 4;
	const result = uploadFile({
		filename: "huge.bin",
		data: "A".repeat(cap + 1)
	});
	assert.equal(result.isError, true);
	assert.match(result.content[0].text, /50 MB/);
});
