"use strict";

/*
Pins what a readonly proxy does to the traffic in BOTH directions, end to end.

test/protocol/proxy-readonly.test.js pins the outbound decision; this pins the
wiring that acts on it, and the filtering of the answers coming back. It is the
only test here that spawns real servers, because these invariants only exist
across two processes: the proxy refuses a write the primary would have
performed, and it hides tools the primary does advertise. Beads
tw-mcp-server-5hd (the write-block, whose -7m7 fix shipped verified by
inspection) and tw-mcp-server-5yq (the inbound filtering).

Cost: two node processes and a throwaway wiki folder, about 1.5 s.

To replicate by hand, in two terminals on one empty wiki folder:

  tiddlywiki ./wiki --mcp rw          # primary, writes .tw-mcp/connect
  tiddlywiki ./wiki --mcp             # proxy, readonly by default

then paste into the PROXY's stdin and watch the primary never write it:

  {"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"put_tiddler","arguments":{"title":"T","fields":{"text":"x"}},"_meta":{"io.modelcontextprotocol/protocolVersion":"2026-07-28"}}}

Asking the primary for that title afterwards must answer "Tiddler not found".
*/

const { test, before, after } = require("node:test");
const assert = require("node:assert");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { TW_CLI_PATH } = require("../setup");

const EDITION_PATH = path.resolve(__dirname, "..", "..");
const PROTOCOL = "2026-07-28";
const META_VERSION = "io.modelcontextprotocol/protocolVersion";
const PROBE_TITLE = "ProxyRelayProbe";
const PROBE_TEXT = "written through a readonly proxy";
const ANSWER_TIMEOUT = 15000;

let wikiPath;
const children = [];
let primary;
let proxy;

function startServer(args) {
	const child = spawn(process.execPath, [TW_CLI_PATH, wikiPath].concat(args), { stdio: ["pipe", "pipe", "pipe"] });
	children.push(child);
	return child;
}

// Sends a request and resolves with the reply that carries the same id.
function asker(child) {
	const waiting = new Map();
	let buffer = "";
	child.stdout.on("data", (chunk) => {
		buffer += chunk;
		const lines = buffer.split("\n");
		buffer = lines.pop();
		for(const line of lines) {
			if(!line.trim()) continue;
			// A log line on stdout is not our concern; only a reply we asked for is.
			let msg = null;
			if(line.charAt(0) === "{") {
				msg = JSON.parse(line);
			}
			if(msg && msg.id !== undefined && waiting.has(msg.id)) {
				waiting.get(msg.id)(msg);
				waiting.delete(msg.id);
			}
		}
	});
	let nextId = 1;
	function request(method, params) {
		const id = nextId++;
		const p = params || {};
		p._meta = p._meta || {};
		p._meta[META_VERSION] = PROTOCOL;
		return new Promise((resolve, reject) => {
			const timer = setTimeout(() => reject(new Error(method + " got no answer in " + ANSWER_TIMEOUT + "ms")), ANSWER_TIMEOUT);
			waiting.set(id, (msg) => { clearTimeout(timer); resolve(msg); });
			child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: id, method: method, params: p }) + "\n");
		});
	}
	return {
		request: request,
		tool: (toolName, args) => request("tools/call", { name: toolName, arguments: args || {} })
	};
}

async function waitForDiscovery(file, timeoutMs) {
	const deadline = Date.now() + timeoutMs;
	while(!fs.existsSync(file)) {
		if(Date.now() > deadline) throw new Error("the primary wrote no .tw-mcp/connect in " + timeoutMs + "ms");
		await new Promise((r) => setTimeout(r, 100));
	}
}

before(async () => {
	wikiPath = fs.mkdtempSync(path.join(os.tmpdir(), "tw-mcp-relay-"));
	fs.mkdirSync(path.join(wikiPath, "tiddlers"));
	fs.copyFileSync(path.join(EDITION_PATH, "tiddlywiki.info"), path.join(wikiPath, "tiddlywiki.info"));
	// The primary must own the pipe before the second process starts, or that
	// one becomes a primary too instead of a proxy.
	primary = asker(startServer(["--mcp", "rw", "label=relay-test-primary"]));
	await waitForDiscovery(path.join(wikiPath, ".tw-mcp", "connect"), 25000);
	proxy = asker(startServer(["--mcp", "label=relay-test-proxy"]));
});

after(() => {
	// Best-effort teardown: the assertions are done and a leftover child or
	// temp folder must not fail the run.
	for(const child of children) {
		try { child.kill(); } catch(e) {}
	}
	try { fs.rmSync(wikiPath, { recursive: true, force: true }); } catch(e) {}
});

test("the second server on one wiki folder starts as a readonly proxy", async () => {
	// The premise of every assertion below: two processes, one pipe.
	const discovery = JSON.parse(fs.readFileSync(path.join(wikiPath, ".tw-mcp", "connect"), "utf8"));
	assert.equal(discovery.pid, children[0].pid, "the discovery file must name the primary");
	const info = await proxy.tool("get_wiki_info", {});
	assert.ok(info.result && !info.result.isError, "the proxy must relay a read to the primary");
});

test("a write refused by the readonly proxy never reaches the readwrite primary", async () => {
	const refusal = await proxy.tool("put_tiddler", { title: PROBE_TITLE, fields: { text: PROBE_TEXT } });
	assert.equal(refusal.result.isError, true, "the proxy must answer the refusal itself");
	assert.match(refusal.result.content[0].text, /disabled in readonly mode/);
	// The primary is readwrite: had the call arrived, the tiddler would exist.
	// Existence is the signal, because get_tiddler answers metadata only.
	const check = await primary.tool("get_tiddler", { title: PROBE_TITLE });
	assert.equal(check.result.isError, true, "the refused write reached the primary anyway");
	assert.match(check.result.content[0].text, /not found/i);
});

test("the primary can still write the tiddler itself, so the check above means something", async () => {
	// Without this, "the primary does not have it" could just mean put_tiddler
	// is broken on this wiki and the refusal proved nothing.
	const written = await primary.tool("put_tiddler", { title: PROBE_TITLE, fields: { text: PROBE_TEXT }, overwrite: true });
	assert.ok(!written.result.isError, "the primary must accept the very call the proxy refused");
	const check = await primary.tool("get_tiddler", { title: PROBE_TITLE });
	assert.ok(!check.result.isError, "the tiddler the primary just wrote must be found");
});

// --- the answers coming BACK through the proxy ------------------------------

test("a readonly proxy hides the write tools its readwrite primary advertises", async () => {
	// The tools/list answer is the primary's, so the filtering happens on the
	// way back. Refusing a call the client was told it could make is a worse
	// experience than never offering it.
	const viaProxy = await proxy.request("tools/list", {});
	const viaPrimary = await primary.request("tools/list", {});
	const proxyNames = viaProxy.result.tools.map((t) => t.name);
	const primaryNames = viaPrimary.result.tools.map((t) => t.name);
	assert.ok(primaryNames.includes("put_tiddler"), "the readwrite primary must offer its write tools");
	assert.ok(!proxyNames.includes("put_tiddler"), "the readonly proxy must not pass a write tool on");
	assert.ok(proxyNames.includes("get_tiddler"), "read tools must survive the filter");
	// Whatever the proxy does advertise must be exactly what it will accept.
	for(const name of proxyNames) {
		assert.ok(primaryNames.includes(name), name + " is advertised by the proxy but not by the primary");
	}
});

test("the discover answer names the proxy that relayed it, not the primary alone", async () => {
	// The client's logs should name the process holding the wiki as well as the
	// one it is talking to; the answer is relayed, so the proxy stamps itself in.
	const reply = await proxy.request("server/discover", {});
	const info = reply.result._meta["io.modelcontextprotocol/serverInfo"];
	assert.equal(info.proxy, true, "a relayed answer must say it came through a proxy");
	assert.equal(info.primaryPid, children[0].pid, "and name the process that actually holds the wiki");
});
