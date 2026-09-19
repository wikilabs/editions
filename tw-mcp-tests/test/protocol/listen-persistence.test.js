"use strict";

/*
`--mcp listen` without a sync adaptor keeps browser edits in memory only; the
server must say so (bead tw-mcp-server-cav). By hand: in a wiki folder whose
tiddlywiki.info lists tw-mcp-core and tw-mcp but not tiddlywiki/filesystem, run
`tiddlywiki . --mcp rw listen port=0`; the log must warn. Add
tiddlywiki/filesystem and the warning must go.

Cost: two node processes, about 1 s.
*/

const { test, before, after } = require("node:test");
const assert = require("node:assert");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { TW_CLI_PATH } = require("../setup");

const WAIT_TIMEOUT = 10000;
const WARNING = /browser edits stay in memory only/i;

const children = [];
let dir;

function makeWiki(name, plugins) {
	const wiki = path.join(dir, name);
	fs.mkdirSync(path.join(wiki, "tiddlers"), { recursive: true });
	fs.writeFileSync(path.join(wiki, "tiddlywiki.info"), JSON.stringify({ plugins }));
	return wiki;
}

// Starts `tiddlywiki <wiki> --mcp rw listen port=0` and resolves with its log once it has started.
function startedLog(wiki) {
	const child = spawn(process.execPath, [TW_CLI_PATH, wiki, "--mcp", "rw", "listen", "port=0"], { stdio: ["pipe", "pipe", "pipe"] });
	children.push(child);
	let log = "";
	child.stdout.on("data", (chunk) => { log += chunk; });
	child.stderr.on("data", (chunk) => { log += chunk; });
	return new Promise((resolve, reject) => {
		const deadline = Date.now() + WAIT_TIMEOUT;
		const poll = () => {
			if(/Server started as PRIMARY/.test(log)) return resolve(log);
			if(Date.now() > deadline) return reject(new Error("server did not start; log: " + log));
			setTimeout(poll, 50);
		};
		poll();
	});
}

before(() => {
	dir = fs.mkdtempSync(path.join(os.tmpdir(), "tw-mcp-listen-"));
	process.on("exit", () => {
		// Best-effort teardown: a folder left in the temp directory harms nothing.
		try {
			fs.rmSync(dir, { recursive: true, force: true });
		} catch(err) {}
	});
});

after(() => {
	for(const child of children) {
		child.stdin.end();
		child.kill();
	}
});

test("--mcp listen without a sync adaptor warns that browser edits are not saved", async () => {
	const log = await startedLog(makeWiki("memory", ["wikilabs/tw-mcp-core", "wikilabs/tw-mcp"]));
	assert.match(log, WARNING);
	assert.match(log, /filesystem: false/);
});

test("--mcp listen with the filesystem plugin saves browser edits and does not warn", async () => {
	const log = await startedLog(makeWiki("disk", ["tiddlywiki/filesystem", "wikilabs/tw-mcp-core", "wikilabs/tw-mcp"]));
	assert.doesNotMatch(log, WARNING);
	assert.match(log, /filesystem: true/);
});
