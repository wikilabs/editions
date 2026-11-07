"use strict";

/*
Pins ROUTE MODE (`--mcp route=<dir>`): one MCP entry that forwards each tool
call to a tw-mcp primary running in a subfolder of <dir> (bead tw-mcp-server-8ge).

createRouteSession takes the folder scan and the pipe client as seams, so a
fake list of wikis and a fake pipe stand in for running servers.

To replicate by hand, boot the test edition and build a session:

  const route = $tw.modules.execute("$:/core/modules/commands/inspect/mcp/mcp-route.js");
  const out = [];
  const s = route.createRouteSession({
    routeDir: "C:/editions",
    send: (line) => out.push(JSON.parse(line)),
    scan: () => [{name: "bundler", label: null, port: 8080, listen: true, pid: 1, pipe: "p1", token: "t"}],
    links: {call: (wiki, msg, cb) => cb(null, {id: msg.id, result: {content: [{type: "text", text: wiki.name}]}})}
  });
  s.dispatch(JSON.stringify({jsonrpc: "2.0", id: 1, method: "tools/call", params: {name: "run_filter", arguments: {filter: "x"}}}));
  console.log(out); // text "bundler"

To try it live, start an edition server with `npm start`, then:
  node editions/scripts/tw.js editions/tw-mcp-tests --mcp route=editions
*/

const { test, before } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { bootTw, loadHandler } = require("../setup");

const ROUTE_TITLE = "$:/core/modules/commands/inspect/mcp/mcp-route.js";
const META_VERSION = "io.modelcontextprotocol/protocolVersion";
const MODERN = { _meta: { [META_VERSION]: "2026-07-28" } };

let route;

before(async () => {
	const $tw = await bootTw();
	route = loadHandler($tw, ROUTE_TITLE);
});

function wiki(name, port, listen) {
	return { name, label: "mcp-" + name, port, listen: listen !== false, pid: 1, pipe: "pipe-" + name, token: "tok-" + name };
}

// A session whose pipe records each forwarded call and answers with the wiki's name.
function build(wikis, options) {
	const sent = [];
	const calls = [];
	const session = route.createRouteSession(Object.assign({
		routeDir: "C:/editions",
		send: (line) => sent.push(JSON.parse(line)),
		scan: () => wikis,
		links: {
			call(target, msg, cb) {
				calls.push({ target: target.name, msg });
				cb(null, { jsonrpc: "2.0", id: "route-1", result: { content: [{ type: "text", text: "from " + target.name }] } });
			}
		}
	}, options || {}));
	function ask(message) {
		session.dispatch(JSON.stringify(Object.assign({ jsonrpc: "2.0" }, message)));
		return sent.filter((m) => m.id === message.id).pop() || null;
	}
	return { ask, calls, sent };
}

function call(name, args) {
	return { id: 7, method: "tools/call", params: Object.assign({ name, arguments: args }, MODERN) };
}

test("a call without wiki goes to the wiki on port 8080", () => {
	const r = build([wiki("aaa", 8081), wiki("bundler", 8080)]);
	const reply = r.ask(call("run_filter", { filter: "[[x]]" }));
	assert.strictEqual(reply.result.content[0].text, "from bundler");
	assert.strictEqual(r.calls[0].target, "bundler");
});

test("the reply keeps the client's id, not the pipe's", () => {
	const r = build([wiki("bundler", 8080)]);
	assert.strictEqual(r.ask(call("run_filter", { filter: "x" })).id, 7);
});

test("wiki picks by folder name, label, port or -server name", () => {
	const wikis = [wiki("bundler", 8080), wiki("uni-link", 8081)];
	for(const key of ["uni-link", "mcp-uni-link", "8081", "uni-link-server"]) {
		const r = build(wikis);
		r.ask(call("run_filter", { filter: "x", wiki: key }));
		assert.strictEqual(r.calls[0].target, "uni-link", "key " + key);
	}
});

test("the wiki argument is not forwarded to the primary", () => {
	const r = build([wiki("bundler", 8080)]);
	r.ask(call("run_filter", { filter: "x", wiki: "bundler" }));
	assert.deepStrictEqual(r.calls[0].msg.params.arguments, { filter: "x" });
});

test("a single wiki on another port is the default", () => {
	const r = build([wiki("uni-link", 8081)]);
	r.ask(call("run_filter", { filter: "x" }));
	assert.strictEqual(r.calls[0].target, "uni-link");
});

test("two wikis and none on 8080 ask for the wiki argument", () => {
	const r = build([wiki("aaa", 8081), wiki("bbb", 8082)]);
	const reply = r.ask(call("run_filter", { filter: "x" }));
	assert.strictEqual(reply.result.isError, true);
	assert.match(reply.result.content[0].text, /Several wikis are running/);
	assert.strictEqual(r.calls.length, 0);
});

test("no running wiki is a tool error, not a protocol error", () => {
	const reply = build([]).ask(call("run_filter", { filter: "x" }));
	assert.strictEqual(reply.result.isError, true);
	assert.match(reply.result.content[0].text, /No TiddlyWiki server is running/);
});

test("an unknown wiki lists the running ones", () => {
	const reply = build([wiki("bundler", 8080)]).ask(call("run_filter", { filter: "x", wiki: "nope" }));
	assert.match(reply.result.content[0].text, /No running wiki matches 'nope'[\s\S]*bundler/);
});

test("default-port moves the default", () => {
	const r = build([wiki("bundler", 8080), wiki("uni-link", 8081)], { defaultPort: 8081 });
	r.ask(call("run_filter", { filter: "x" }));
	assert.strictEqual(r.calls[0].target, "uni-link");
});

test("tools/list starts with list_wikis and every tool takes wiki", () => {
	const reply = build([]).ask({ id: 2, method: "tools/list", params: MODERN });
	const tools = reply.result.tools;
	assert.strictEqual(tools[0].name, "list_wikis");
	for(const t of tools.slice(1)) {
		assert.ok(t.inputSchema.properties.wiki, t.name + " has no wiki argument");
	}
});

test("readonly is the default and refuses write tools without forwarding", () => {
	const r = build([wiki("bundler", 8080)]);
	const reply = r.ask(call("put_tiddler", { title: "x" }));
	assert.match(reply.result.content[0].text, /disabled in readonly mode/);
	assert.strictEqual(r.calls.length, 0);
});

test("rw forwards write tools", () => {
	const r = build([wiki("bundler", 8080)], { readonly: false });
	r.ask(call("put_tiddler", { title: "x" }));
	assert.strictEqual(r.calls[0].msg.params.name, "put_tiddler");
});

test("list_wikis names each running wiki and its port", () => {
	const reply = build([wiki("bundler", 8080), wiki("uni-link", 8081, false)]).ask(call("list_wikis", {}));
	const text = reply.result.content[0].text;
	assert.match(text, /bundler \(label mcp-bundler\) http:\/\/localhost:8080/);
	assert.match(text, /uni-link .* no HTTP/);
});

test("scanWikis keeps live primaries and skips dead pids and junk", () => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "route-scan-"));
	try {
		const write = (name, data) => {
			fs.mkdirSync(path.join(dir, name, ".tw-mcp"), { recursive: true });
			fs.writeFileSync(path.join(dir, name, ".tw-mcp", "connect"), typeof data === "string" ? data : JSON.stringify(data));
		};
		write("live", { pid: process.pid, pipe: "p", token: "t", port: 8080, listen: true, label: "L" });
		write("dead", { pid: 2147483646, pipe: "p", token: "t" });
		write("broken", "{not json");
		fs.mkdirSync(path.join(dir, "empty"));
		assert.deepStrictEqual(route.scanWikis(dir).map((w) => w.name), ["live"]);
	} finally {
		fs.rmSync(dir, { recursive: true, force: true });
	}
});
