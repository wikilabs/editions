"use strict";

/*
tw-upload.js, the command-line helper that feeds files to upload_file (bead
tw-mcp-server-z17). By hand, from a wiki edition that includes another wiki:
`node <plugins>/wikilabs/tw-mcp/tiddlers/sidecar/tw-upload.js photo.png --wiki .`
must find the server's .tw-mcp/connect in the included wiki, and without a
server it must say to start `--mcp rw`.
*/

const { test, before } = require("node:test");
const assert = require("node:assert");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

// tw-upload.js is not part of the plugin payload; find it below TIDDLYWIKI_PLUGIN_PATH.
function findTwUpload() {
	for(const dir of (process.env.TIDDLYWIKI_PLUGIN_PATH || "").split(path.delimiter)) {
		const candidate = path.resolve(dir, "wikilabs", "tw-mcp", "tiddlers", "sidecar", "tw-upload.js");
		if(dir && fs.existsSync(candidate)) return candidate;
	}
	throw new Error("tw-upload.js not found below TIDDLYWIKI_PLUGIN_PATH");
}

let dir, outer, inner, image;

before(() => {
	dir = fs.mkdtempSync(path.join(os.tmpdir(), "tw-mcp-upload-"));
	process.on("exit", () => {
		// Best-effort teardown: a folder left in the temp directory harms nothing.
		try {
			fs.rmSync(dir, { recursive: true, force: true });
		} catch(err) {}
	});
	inner = path.join(dir, "inner");
	outer = path.join(dir, "outer-server");
	fs.mkdirSync(inner);
	fs.mkdirSync(outer);
	fs.writeFileSync(path.join(inner, "tiddlywiki.info"), JSON.stringify({ plugins: [] }));
	fs.writeFileSync(path.join(outer, "tiddlywiki.info"), JSON.stringify({ includeWikis: ["../inner"] }));
	image = path.join(dir, "probe.png");
	fs.writeFileSync(image, "not really a png");
});

function upload(wiki) {
	const r = spawnSync(process.execPath, [findTwUpload(), image, "--wiki", wiki], { encoding: "utf8", timeout: 20000 });
	return r.stdout + r.stderr;
}

test("tw-upload without a running server says to start it with --mcp rw", () => {
	const output = upload(outer);
	assert.match(output, /No MCP server found/);
	assert.match(output, /--mcp rw/);
	assert.doesNotMatch(output, /\+plugins\/tiddlywiki\/filesystem/);
});

test("tw-upload finds the server of an edition in the first wiki it includes, as the server writes it", () => {
	// A pipe nobody listens on: finding it is what is tested, the connection then fails.
	const pipe = process.platform === "win32" ? "\\\\.\\pipe\\tw-upload-test-nobody" : path.join(dir, "nobody.sock");
	fs.mkdirSync(path.join(inner, ".tw-mcp"));
	fs.writeFileSync(path.join(inner, ".tw-mcp", "connect"), JSON.stringify({ pipe, token: "t" }));
	const output = upload(outer);
	assert.doesNotMatch(output, /No MCP server found/);
	assert.ok(output.includes("Connecting to MCP server: " + pipe), output);
});
