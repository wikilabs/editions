"use strict";

/*
A wiki that lists wikilabs/tw-mcp without wikilabs/tw-mcp-core (bead
tw-mcp-server-eva). By hand: in a wiki folder whose tiddlywiki.info lists only
"wikilabs/tw-mcp", run `tiddlywiki . --mcp`; it must say to add
wikilabs/tw-mcp-core and stop, and `tiddlywiki . --version` must still work.
*/

const { test, before } = require("node:test");
const assert = require("node:assert");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { TW_CLI_PATH } = require("../setup");

let wikiPath;

before(() => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tw-mcp-nocore-"));
	process.on("exit", () => {
		// Best-effort teardown: a folder left in the temp directory harms nothing.
		try {
			fs.rmSync(dir, { recursive: true, force: true });
		} catch(err) {}
	});
	wikiPath = path.join(dir, "wiki");
	fs.mkdirSync(path.join(wikiPath, "tiddlers"), { recursive: true });
	fs.writeFileSync(path.join(wikiPath, "tiddlywiki.info"), JSON.stringify({ plugins: ["wikilabs/tw-mcp"] }));
});

function run(args) {
	const r = spawnSync(process.execPath, [TW_CLI_PATH, wikiPath].concat(args), { stdio: ["ignore", "pipe", "pipe"], encoding: "utf8", timeout: 20000 });
	return { status: r.status, output: r.stdout + r.stderr };
}

for(const command of ["--mcp", "--lsp"]) {
	test(command + " without tw-mcp-core names the plugin to add and stops", () => {
		const r = run([command]);
		assert.notEqual(r.status, 0);
		assert.match(r.output, /wikilabs\/tw-mcp-core/);
		assert.doesNotMatch(r.output, /Cannot find module/);
	});
}

test("a wiki without tw-mcp-core still runs other commands", () => {
	const r = run(["--version"]);
	assert.equal(r.status, 0, r.output);
});
