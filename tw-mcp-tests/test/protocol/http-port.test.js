"use strict";

/*
Pins how `--mcp listen` and `--mcp sse` choose the HTTP port (bead tw-mcp-server-8ge):
without port=, or with the default port, the first free port from the default up
is used; any other port= must be free. A port counts as used when a server
answers on 127.0.0.1 or [::1].

The tests occupy ports the OS hands out and pass that port as the default, so
they do not depend on what runs on 8080.

To replicate by hand, keep one server on 8080 and start a second one:
  tiddlywiki ./wiki-a --mcp listen      -> "Serving on ...:8080"
  tiddlywiki ./wiki-b --mcp listen      -> "Port 8080 is in use, trying 8081"
  tiddlywiki ./wiki-c --mcp listen port=8081   -> "Port 8081 is already in use ..." and exit code 1
*/

const { test, before, after } = require("node:test");
const assert = require("node:assert");
const net = require("node:net");
const { bootTw, loadHandler } = require("../setup");

const MCP_COMMAND_TITLE = "$:/core/modules/commands/mcp.js";

let mcp;
const servers = [];

before(async () => {
	const $tw = await bootTw();
	mcp = loadHandler($tw, MCP_COMMAND_TITLE);
});

after(() => {
	for(const s of servers) {
		s.close();
	}
});

// Listens on host:port (0 = any free port); resolves the port, or null when the host cannot be bound.
function occupy(host, port) {
	return new Promise((resolve) => {
		const s = net.createServer();
		s.once("error", () => resolve(null));
		s.listen(port, host, () => {
			servers.push(s);
			resolve(s.address().port);
		});
	});
}

function taken(port, host) {
	return new Promise((resolve) => mcp.isPortTaken(port, host, resolve));
}

function choose(requested, defaultPort) {
	return new Promise((resolve) => mcp.choosePort(requested, undefined, (err, port) => resolve({ err, port }), defaultPort));
}

// Two neighbouring busy ports: base on 127.0.0.1, base + 1 on [::1] only.
async function busyPair() {
	for(let i = 0; i < 20; i++) {
		const base = await occupy("127.0.0.1", 0);
		const second = await occupy("::1", base + 1);
		if(second !== null) {
			return base;
		}
	}
	return null;
}

test("a closed port is free", async () => {
	const port = await occupy("127.0.0.1", 0);
	servers.pop().close();
	await new Promise((r) => setTimeout(r, 50));
	assert.strictEqual(await taken(port), false);
});

test("a server on 127.0.0.1 makes the port taken", async () => {
	const port = await occupy("127.0.0.1", 0);
	assert.strictEqual(await taken(port), true);
});

test("a server on [::1] only makes the port taken too", async (t) => {
	const port = await occupy("::1", 0);
	if(port === null) {
		return t.skip("IPv6 loopback not available");
	}
	assert.strictEqual(await taken(port), true);
});

test("the default port steps up past busy ports on either loopback", async (t) => {
	const base = await busyPair();
	if(base === null) {
		return t.skip("no free [::1] neighbour port");
	}
	const { err, port } = await choose(undefined, base);
	assert.strictEqual(err, null);
	assert.ok(Number(port) >= base + 2, "got " + port + ", base " + base);
	assert.strictEqual(await taken(Number(port)), false);
});

test("port= equal to the default steps up as well", async () => {
	const base = await occupy("127.0.0.1", 0);
	const { err, port } = await choose(String(base), base);
	assert.strictEqual(err, null);
	assert.ok(Number(port) > base);
});

test("another busy port= is an error, not a different port", async () => {
	const busy = await occupy("127.0.0.1", 0);
	const { err, port } = await choose(String(busy), busy + 1000);
	assert.match(err, new RegExp("Port " + busy + " is already in use"));
	assert.strictEqual(port, undefined);
});

test("another free port= is used as given", async () => {
	const free = await occupy("127.0.0.1", 0);
	servers.pop().close();
	await new Promise((r) => setTimeout(r, 50));
	const { err, port } = await choose(String(free), free + 1000);
	assert.strictEqual(err, null);
	assert.strictEqual(port, String(free));
});

test("a port= naming an environment variable is passed through unchecked", async () => {
	const { err, port } = await choose("MY_PORT_VAR", 8080);
	assert.strictEqual(err, null);
	assert.strictEqual(port, "MY_PORT_VAR");
});
