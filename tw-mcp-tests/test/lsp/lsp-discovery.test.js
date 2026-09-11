"use strict";

/*
Pins the .tw-mcp/lsp discovery file and the free-port fallback in lsp-lib.js:
an editor reads the file to find which port the wiki's --lsp got.

By hand, in a booted test edition:

  const lib = $tw.modules.execute("$:/core/modules/commands/inspect/lsp/lsp-lib.js");
  const server = lib.startSocketServer({ discoveryDir: "E:/tmp/wiki" });
  // once listening, E:/tmp/wiki/.tw-mcp/lsp holds
  // {"pid":<this process>,"host":"127.0.0.1","port":6009,"version":"...","wiki":"..."}
  server.close();
*/

const { test, before } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const net = require("net");
const os = require("os");
const path = require("path");
const { bootTw, loadHandler } = require("../setup");

let lib, discovery;

before(async () => {
	const $tw = await bootTw();
	lib = loadHandler($tw, "$:/core/modules/commands/inspect/lsp/lsp-lib.js");
	discovery = loadHandler($tw, "$:/core/modules/commands/inspect/lsp/lsp-discovery.js");
});

function tempWiki() {
	return fs.mkdtempSync(path.join(os.tmpdir(), "tw-lsp-discovery-"));
}

function once(emitter, event) {
	return new Promise((resolve) => emitter.once(event, resolve));
}

function close(server) {
	return new Promise((resolve) => server.close(resolve));
}

// A port some other process holds, as a second wiki meets 6009.
async function occupiedPort() {
	const blocker = net.createServer();
	blocker.listen(0, "127.0.0.1");
	await once(blocker, "listening");
	return blocker;
}

test("the listening port is written to .tw-mcp/lsp", async () => {
	const dir = tempWiki();
	const server = lib.startSocketServer({ port: 0, discoveryDir: dir });
	try {
		await once(server, "listening");
		const data = JSON.parse(fs.readFileSync(path.join(dir, ".tw-mcp", "lsp"), "utf8"));
		assert.strictEqual(data.pid, process.pid);
		assert.strictEqual(data.host, "127.0.0.1");
		assert.strictEqual(data.port, server.address().port);
		assert.ok(data.port > 0);
	} finally {
		await close(server);
		fs.rmSync(dir, { recursive: true, force: true });
	}
});

test("a taken default port falls back to a free one", async () => {
	const dir = tempWiki(),
		blocker = await occupiedPort(),
		taken = blocker.address().port;
	const server = lib.startSocketServer({ defaultPort: taken, discoveryDir: dir });
	try {
		await once(server, "listening");
		assert.notStrictEqual(server.address().port, taken);
		assert.strictEqual(discovery.readDiscovery(dir).port, server.address().port);
	} finally {
		await close(server);
		await close(blocker);
		fs.rmSync(dir, { recursive: true, force: true });
	}
});

test("a taken port= is not replaced, and nothing is recorded", async () => {
	const dir = tempWiki(),
		blocker = await occupiedPort(),
		taken = blocker.address().port;
	const server = lib.startSocketServer({ port: taken, discoveryDir: dir });
	try {
		const err = await once(server, "error");
		assert.strictEqual(err.code, "EADDRINUSE");
		assert.strictEqual(server.listening, false);
		assert.strictEqual(discovery.readDiscovery(dir), null);
	} finally {
		await close(blocker);
		fs.rmSync(dir, { recursive: true, force: true });
	}
});

test("the file is removed only while it names this process", () => {
	const dir = tempWiki();
	try {
		discovery.writeDiscovery(dir, { pid: process.pid + 1, port: 6010 });
		assert.strictEqual(discovery.removeDiscovery(dir, process.pid), false);
		assert.strictEqual(discovery.readDiscovery(dir).port, 6010);
		discovery.writeDiscovery(dir, { pid: process.pid, port: 6011 });
		assert.strictEqual(discovery.removeDiscovery(dir, process.pid), true);
		assert.strictEqual(discovery.readDiscovery(dir), null);
	} finally {
		fs.rmSync(dir, { recursive: true, force: true });
	}
});
