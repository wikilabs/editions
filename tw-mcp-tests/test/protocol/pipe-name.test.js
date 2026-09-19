"use strict";

/*
Each wiki folder gets its own pipe, whatever path it was started with (bead
tw-mcp-server-oj0). On Windows the pipe name is built from the wiki path, so it
must be the resolved one; on other systems the socket lives in the wiki folder
and this passes either way.

To replicate by hand, in two empty wiki folders A and B that list tw-mcp-core
and tw-mcp: run `tiddlywiki . --mcp` inside A, then inside B. Both must log
"Server started as PRIMARY" with different pipes and write .tw-mcp/connect.
Starting A again as `tiddlywiki <absolute path of A> --mcp` must log
"Server started as PROXY".

Cost: three node processes, about 2 s.
*/

const { test, before, after } = require("node:test");
const assert = require("node:assert");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { TW_CLI_PATH } = require("../setup");

const WAIT_TIMEOUT = 10000;

const children = [];
let wikiA, wikiB;

function makeWiki(parent, name) {
	const dir = path.join(parent, name);
	fs.mkdirSync(path.join(dir, "tiddlers"), { recursive: true });
	fs.writeFileSync(path.join(dir, "tiddlywiki.info"), JSON.stringify({
		plugins: ["wikilabs/tw-mcp-core", "wikilabs/tw-mcp"]
	}));
	return dir;
}

// Starts `tiddlywiki <wikiArg> --mcp` in cwd, keeping stdin open so the server stays up.
function startServer(cwd, wikiArg) {
	const child = spawn(process.execPath, [TW_CLI_PATH, wikiArg, "--mcp"], { cwd, stdio: ["pipe", "pipe", "pipe"] });
	child.log = "";
	child.stderr.on("data", (chunk) => { child.log += chunk; });
	children.push(child);
	return child;
}

function waitFor(what, check) {
	const deadline = Date.now() + WAIT_TIMEOUT;
	return new Promise((resolve, reject) => {
		const poll = () => {
			if(check()) return resolve();
			if(Date.now() > deadline) return reject(new Error("timed out waiting for " + what));
			setTimeout(poll, 50);
		};
		poll();
	});
}

const connectFile = (wiki) => path.join(wiki, ".tw-mcp", "connect");

before(() => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tw-mcp-pipe-"));
	process.on("exit", () => {
		// Best-effort teardown: a folder left in the temp directory harms nothing.
		try {
			fs.rmSync(dir, { recursive: true, force: true });
		} catch(err) {}
	});
	wikiA = makeWiki(dir, "a");
	wikiB = makeWiki(dir, "b");
});

after(() => {
	for(const child of children) {
		child.stdin.end();
		child.kill();
	}
});

test("two wikis started as `.` in different folders each get their own pipe", async () => {
	startServer(wikiA, ".");
	await waitFor("wiki A's connect file", () => fs.existsSync(connectFile(wikiA)));
	const serverB = startServer(wikiB, ".");
	await waitFor("wiki B's connect file", () => fs.existsSync(connectFile(wikiB))).catch((err) => {
		throw new Error(err.message + "; B logged: " + serverB.log.trim());
	});
	const pipeA = JSON.parse(fs.readFileSync(connectFile(wikiA), "utf8")).pipe;
	const pipeB = JSON.parse(fs.readFileSync(connectFile(wikiB), "utf8")).pipe;
	assert.notEqual(pipeA, pipeB);
});

test("the same folder started by its absolute path joins the server already there", async () => {
	const second = startServer(os.tmpdir(), wikiA);
	await waitFor("the second server's start line", () => /Server started as (PRIMARY|PROXY)/.test(second.log));
	assert.match(second.log, /Server started as PROXY/);
});
