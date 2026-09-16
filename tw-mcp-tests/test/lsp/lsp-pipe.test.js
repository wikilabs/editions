"use strict";

/*
Pins --lsp pipe=<name>, the transport an editor uses to start a wiki of its own:
the process connects to the pipe the editor created, serves that one session,
names the wiki it answers from, never writes to disk, and exits when the pipe
closes.

By hand: listen on a pipe first (in node, net.createServer().listen(name)), then

  tiddlywiki ./wiki --lsp pipe=<name>
  # [tw-lsp] Wiki E:\...\wiki; tiddlers folder E:\...\wiki\tiddlers; 812 tiddlers, 1406 shadows
  # [tw-lsp] Connected to the editor on <name> (v..., PID ...)

Closing the listening side ends the tiddlywiki process.
*/

const { test, before, afterEach } = require("node:test");
const assert = require("node:assert");
const net = require("net");
const os = require("os");
const path = require("path");
const { bootTw, loadHandler } = require("../setup");

let $tw, lib;

before(async () => {
	$tw = await bootTw();
	lib = loadHandler($tw, "$:/core/modules/commands/inspect/lsp/lsp-lib.js");
});

afterEach(() => {
	delete $tw.lsp;
});

function pipeName() {
	const id = "tw-lsp-test-" + process.pid + "-" + Math.random().toString(16).slice(2);
	return process.platform === "win32" ? "\\\\.\\pipe\\" + id : path.join(os.tmpdir(), id + ".sock");
}

function frame(message) {
	const body = JSON.stringify(message);
	return "Content-Length: " + Buffer.byteLength(body, "utf8") + "\r\n\r\n" + body;
}

// The editor's side of the pipe: resolves with the socket the LSP process connects on.
async function editorPipe() {
	const name = pipeName(),
		server = net.createServer();
	await new Promise((resolve) => server.listen(name, resolve));
	const connection = new Promise((resolve) => server.once("connection", resolve));
	return { name: name, server: server, connection: connection };
}

// Framed messages from the LSP process, one at a time.
function messages(socket) {
	let buffer = Buffer.alloc(0);
	const queue = [],
		waiting = [];
	socket.on("data", (chunk) => {
		buffer = Buffer.concat([buffer, chunk]);
		for(;;) {
			const headerEnd = buffer.indexOf("\r\n\r\n");
			if(headerEnd < 0) {
				return;
			}
			const length = parseInt(/content-length:\s*(\d+)/i.exec(buffer.slice(0, headerEnd).toString("ascii"))[1], 10);
			if(buffer.length < headerEnd + 4 + length) {
				return;
			}
			const message = JSON.parse(buffer.slice(headerEnd + 4, headerEnd + 4 + length).toString("utf8"));
			buffer = buffer.slice(headerEnd + 4 + length);
			if(waiting.length) {
				waiting.shift()(message);
			} else {
				queue.push(message);
			}
		}
	});
	return () => queue.length ? Promise.resolve(queue.shift()) : new Promise((resolve) => waiting.push(resolve));
}

// The first exit code the LSP process asked for.
function exitRecorder() {
	let settle;
	const code = new Promise((resolve) => { settle = resolve; });
	return { exit: (value) => settle(value), code: code };
}

function closeServer(server) {
	return new Promise((resolve) => server.close(resolve));
}

test("the pipe carries an LSP session, and initialized names the wiki", async () => {
	const pipe = await editorPipe(),
		recorder = exitRecorder(),
		client = lib.startPipeClient(pipe.name, { exit: recorder.exit });
	try {
		const socket = await pipe.connection,
			next = messages(socket);
		socket.write(frame({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} }));
		const initialized = await next();
		assert.strictEqual(initialized.id, 1);
		assert.ok(initialized.result.capabilities.hoverProvider);
		socket.write(frame({ jsonrpc: "2.0", method: "initialized", params: {} }));
		const logged = await next();
		assert.strictEqual(logged.method, "window/logMessage");
		assert.ok(logged.params.message.includes(path.resolve($tw.boot.wikiPath)), logged.params.message);
	} finally {
		client.destroy();
		await closeServer(pipe.server);
	}
});

test("once initialized, the editor is told which MCP server the wiki is linked to, and of every change", async () => {
	const pipe = await editorPipe(),
		recorder = exitRecorder();
	let linked = null;
	const told = [];
	$tw.lsp = { mcpLink: { server: () => linked, update: (info) => told.push(info) } };
	const client = lib.startPipeClient(pipe.name, { exit: recorder.exit });
	try {
		const socket = await pipe.connection,
			next = messages(socket);
		socket.write(frame({ jsonrpc: "2.0", id: 1, method: "initialize", params: { clientInfo: { name: "Test Editor", version: "1.0" } } }));
		assert.ok((await next()).result.capabilities, "initialize is answered");
		assert.deepEqual(told, [{ client: "Test Editor 1.0" }], "the MCP link learns which editor connected");
		// Before initialized nothing may be sent but the answer, so a change now is held back.
		linked = { pid: 4242, label: "sse-primary", browserPort: 8888 };
		$tw.lsp.announceMcpServer();
		socket.write(frame({ jsonrpc: "2.0", method: "initialized", params: {} }));
		assert.strictEqual((await next()).method, "window/logMessage");
		assert.deepEqual(await next(), { jsonrpc: "2.0", method: "tiddlywiki/mcpServer", params: { server: { pid: 4242, label: "sse-primary", browserPort: 8888 } } });
		linked = null;
		$tw.lsp.announceMcpServer();
		assert.deepEqual((await next()).params, { server: null });
	} finally {
		client.destroy();
		await closeServer(pipe.server);
	}
});

test("the process exits cleanly when the editor closes the pipe", async () => {
	const pipe = await editorPipe(),
		recorder = exitRecorder();
	lib.startPipeClient(pipe.name, { exit: recorder.exit });
	const socket = await pipe.connection;
	socket.destroy();
	assert.strictEqual(await recorder.code, 0);
	await closeServer(pipe.server);
});

test("a pipe nobody listens on ends the process with a failure", async () => {
	const recorder = exitRecorder();
	lib.startPipeClient(pipeName(), { exit: recorder.exit });
	assert.strictEqual(await recorder.code, 1);
});

test("pipe= mode never writes: the syncer's saves and deletes touch no file", async () => {
	const pipe = await editorPipe(),
		recorder = exitRecorder(),
		saved = $tw.syncer,
		refuse = () => { throw new Error("wrote to disk"); };
	$tw.syncer = { syncadaptor: { saveTiddler: refuse, deleteTiddler: refuse } };
	try {
		lib.startLSPServer({ pipe: pipe.name, exit: recorder.exit, label: "lsp-probe" });
		assert.strictEqual($tw.lsp.transport, "pipe");
		assert.strictEqual($tw.lsp.label, "lsp-probe");
		assert.strictEqual($tw.lsp.port, null);
		const results = [];
		$tw.syncer.syncadaptor.saveTiddler(new $tw.Tiddler({ title: "Probe" }), (err) => results.push(err), {});
		$tw.syncer.syncadaptor.deleteTiddler("Probe", (err) => results.push(err), {});
		assert.deepStrictEqual(results, [null, null]);
		(await pipe.connection).destroy();
		await recorder.code;
	} finally {
		if($tw.lsp && $tw.lsp.watcher) {
			$tw.lsp.watcher.close();
		}
		if($tw.lsp && $tw.lsp.mcpLink) {
			$tw.lsp.mcpLink.close();
		}
		$tw.syncer = saved;
		await closeServer(pipe.server);
	}
});

test("label= on the command line wins over the label in tiddlywiki.info, else lsp-<wiki folder name>", () => {
	const saved = $tw.boot.wikiInfo;
	try {
		$tw.boot.wikiInfo = Object.assign({}, saved, { lsp: { autostart: true, label: "from-info" } });
		assert.strictEqual(lib.resolveLabel({ label: "from-command" }), "from-command");
		assert.strictEqual(lib.resolveLabel({}), "from-info");
		$tw.boot.wikiInfo = Object.assign({}, saved, { lsp: undefined });
		assert.strictEqual(lib.resolveLabel({}), "lsp-" + path.basename(path.resolve($tw.boot.wikiPath)));
	} finally {
		$tw.boot.wikiInfo = saved;
	}
});

test("the wiki description names the folder, its includes and the counts", () => {
	const saved = $tw.boot.wikiInfo,
		wikiPath = path.resolve($tw.boot.wikiPath);
	$tw.boot.wikiInfo = Object.assign({}, saved, { includeWikis: ["../aaa", { path: "../bbb" }] });
	try {
		const text = lib.describeWiki();
		assert.ok(text.startsWith("Wiki " + wikiPath + ", including " + path.resolve(wikiPath, "../aaa") + ", " + path.resolve(wikiPath, "../bbb")), text);
		assert.match(text, /; \d+ tiddlers, \d+ shadows$/);
	} finally {
		$tw.boot.wikiInfo = saved;
	}
});
