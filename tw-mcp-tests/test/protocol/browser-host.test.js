"use strict";

/*
Pins the host a browser link uses for this process's HTTP server: a host= name
as given, else the address the server is bound to, so a link never makes the
browser resolve localhost and try the wrong address first.

To replicate by hand:
  tiddlywiki ./wiki --mcp listen host=localhost   -> .tw-mcp/connect "host":"[::1]" (where localhost resolves to ::1)
  tiddlywiki ./wiki --mcp listen                  -> "host":"127.0.0.1"
  tiddlywiki ./wiki --mcp listen host=hugo        -> "host":"hugo"
*/

const { test, before, afterEach } = require("node:test");
const assert = require("node:assert");
const { bootTw, loadHandler } = require("../setup");

let $tw;
let mcpLib;

before(async () => {
	$tw = await bootTw();
	mcpLib = loadHandler($tw, "$:/core/modules/commands/inspect/mcp/mcp-lib.js");
});

afterEach(() => {
	delete $tw.httpServer;
});

// Test scaffolding: an HTTP server started with host= and bound to address.
function serving(host, address) {
	$tw.httpServer = {
		server: { get: (name) => (name === "host" ? host : undefined) },
		nodeServer: { address: () => ({ address: address, port: 8080 }) }
	};
	return mcpLib.browserHost();
}

test("a host= name is used as given", () => {
	assert.strictEqual(serving("hugo", "192.168.1.20"), "hugo");
});

test("localhost becomes the address it was bound to, bracketed for IPv6", () => {
	assert.strictEqual(serving("localhost", "::1"), "[::1]");
	assert.strictEqual(serving("localhost", "127.0.0.1"), "127.0.0.1");
});

test("a wildcard bind is reached at 127.0.0.1", () => {
	assert.strictEqual(serving("0.0.0.0", "0.0.0.0"), "127.0.0.1");
	assert.strictEqual(serving("::", "::"), "127.0.0.1");
});

test("an IPv6 host= is bracketed", () => {
	assert.strictEqual(serving("::1", "::1"), "[::1]");
});

test("no HTTP server means no host", () => {
	assert.strictEqual(mcpLib.browserHost(), undefined);
});
