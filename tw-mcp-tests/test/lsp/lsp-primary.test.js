"use strict";

/*
Pins the link between the LSP process an editor starts (--lsp pipe=) and the MCP
server of its wiki. Each holds its own copy of the wiki, so the LSP process keeps
a connection to the server named in .tw-mcp/connect: it says hello (PID, wiki,
editor), notices the server come and go, and forwards files saved in the editor
(wikilabs.tw-mcp/reloadFile). The server lists the LSP processes in get_wiki_info.
Both requests are internal, not MCP tools.

Every title here is under $:/temp/, which the wiki does not sync to disk.

By hand, with `npm start` running and VS Code connected, the TiddlyWiki LSP output shows

  [tw-lsp] MCP server found: PID <n>, browser on port 8888

the dev server console shows `LSP client: Visual Studio Code ... (PID <m>, pipe) on <wiki>`,
get_wiki_info lists `LSP: pipe for Visual Studio Code ...`, and saving a .tid logs
`[tw-lsp] The MCP server reloaded <title>`. Stopping the server logs `MCP server gone`.
*/

const { test, before } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const { bootTw, loadHandler } = require("../setup");

const PREFIX = "$:/temp/tw-mcp-tests/primary/";
const TITLE = PREFIX + "probe";
const TOKEN = "test-token";

let $tw, mcpLib, primary, lspLib;

before(async () => {
	$tw = await bootTw();
	mcpLib = loadHandler($tw, "$:/core/modules/commands/inspect/mcp/mcp-lib.js");
	primary = loadHandler($tw, "$:/core/modules/commands/inspect/lsp/lsp-primary.js");
	lspLib = loadHandler($tw, "$:/core/modules/commands/inspect/lsp/lsp-lib.js");
});

// Test scaffolding: a throwaway folder stands in for the wiki's tiddlers folder.
async function withTiddlersFolder(fn) {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tw-lsp-primary-")),
		saved = $tw.boot.wikiTiddlersPath;
	$tw.boot.wikiTiddlersPath = dir;
	try {
		await fn(dir);
	} finally {
		$tw.boot.wikiTiddlersPath = saved;
		for(const title of Object.keys($tw.boot.files).concat($tw.wiki.allTitles())) {
			if(title.startsWith(PREFIX)) {
				delete $tw.boot.files[title];
				$tw.wiki.deleteTiddler(title);
			}
		}
		fs.rmSync(dir, { recursive: true, force: true });
	}
}

function dispatch(message) {
	let reply = null;
	mcpLib.dispatchMessage(JSON.stringify(message), (line) => { reply = JSON.parse(line); });
	return reply;
}

function reloadRequest(filepath) {
	return { jsonrpc: "2.0", id: 7, method: "wikilabs.tw-mcp/reloadFile", params: { path: filepath } };
}

function pipeName() {
	const id = "tw-lsp-primary-" + process.pid + "-" + Math.random().toString(16).slice(2);
	return process.platform === "win32" ? "\\\\.\\pipe\\" + id : path.join(os.tmpdir(), id + ".sock");
}

// A stand-in for the MCP server's pipe: each newline-delimited message goes to
// answer(message, reply, line), and the sockets it accepted can be dropped.
async function fakeMcpServer(answer) {
	const name = pipeName(),
		sockets = [],
		server = net.createServer((socket) => {
			sockets.push(socket);
			let buffer = "";
			socket.on("data", (chunk) => {
				buffer += chunk.toString("utf8");
				let end;
				while((end = buffer.indexOf("\n")) >= 0) {
					const line = buffer.slice(0, end);
					buffer = buffer.slice(end + 1);
					answer(JSON.parse(line), (text) => socket.write(text + "\n"), line);
				}
			});
		});
	await new Promise((resolve) => server.listen(name, resolve));
	return {
		discovery: { pid: process.pid + 1, pipe: name, token: TOKEN, label: "sse-primary", listen: true, port: 8888 },
		dropClients: () => sockets.forEach((socket) => socket.destroy()),
		close: () => new Promise((resolve) => server.close(resolve))
	};
}

async function until(condition, what) {
	const deadline = Date.now() + 3000;
	while(!condition()) {
		if(Date.now() > deadline) {
			throw new Error("timed out waiting for " + what);
		}
		await new Promise((resolve) => setTimeout(resolve, 10));
	}
}

function reloadOver(link, filepath) {
	return new Promise((resolve) => {
		link.reloadFile(filepath, (err, titles) => resolve({ err: err, titles: titles }));
	});
}

test("the MCP server reloads a file saved in the editor and names its titles", async () => {
	await withTiddlersFolder((dir) => {
		const file = path.join(dir, "probe.tid");
		fs.writeFileSync(file, "title: " + TITLE + "\n\nsaved");
		const reply = dispatch(reloadRequest(file));
		assert.deepEqual(reply.result.titles, [TITLE]);
		assert.strictEqual($tw.wiki.getTiddlerText(TITLE), "saved");
	});
});

test("the MCP server leaves a file it does not own alone", async () => {
	const elsewhere = fs.mkdtempSync(path.join(os.tmpdir(), "tw-lsp-elsewhere-"));
	try {
		const file = path.join(elsewhere, "probe.tid");
		fs.writeFileSync(file, "title: " + TITLE + "\n\noutside");
		assert.strictEqual(dispatch(reloadRequest(file)).result.titles, null);
		assert.strictEqual($tw.wiki.tiddlerExists(TITLE), false);
	} finally {
		fs.rmSync(elsewhere, { recursive: true, force: true });
	}
});

test("a reload request without a path is refused", () => {
	const reply = dispatch({ jsonrpc: "2.0", id: 8, method: "wikilabs.tw-mcp/reloadFile", params: {} });
	assert.strictEqual(reply.error.code, -32602);
});

test("the link says hello with the pipe's token and its label, and says it again when it learns the editor", async () => {
	const hellos = [],
		logged = [],
		server = await fakeMcpServer((message) => hellos.push(message));
	const link = primary.createLink({ readDiscovery: () => server.discovery, log: (line) => logged.push(line), hello: { pid: process.pid, transport: "pipe", label: "lsp-probe", wiki: "/w" } });
	try {
		await until(() => hellos.length === 1, "the hello");
		assert.strictEqual(hellos[0].method, "wikilabs.tw-mcp/lspHello");
		assert.strictEqual(hellos[0].params._meta["wikilabs.tw-mcp/auth"], TOKEN);
		assert.strictEqual(hellos[0].params._meta["wikilabs.tw-mcp/label"], "lsp-probe");
		assert.strictEqual(hellos[0].params.label, "lsp-probe");
		assert.strictEqual(hellos[0].params.wiki, "/w");
		assert.ok(logged.includes("MCP server found: PID " + server.discovery.pid + " @sse-primary, browser on port 8888"), logged.join("\n"));
		link.update({ client: "Visual Studio Code 1.123.0" });
		await until(() => hellos.length === 2, "the second hello");
		assert.strictEqual(hellos[1].params.client, "Visual Studio Code 1.123.0");
		assert.strictEqual(hellos[1].params.pid, process.pid);
	} finally {
		link.close();
		await server.close();
	}
});

test("a saved file goes over the open link, and the server's titles come back", async () => {
	await withTiddlersFolder(async (dir) => {
		const file = path.join(dir, "probe.tid");
		fs.writeFileSync(file, "title: " + TITLE + "\n\nrelayed");
		const server = await fakeMcpServer((message, reply, line) => {
			if(message.id === undefined) {
				return;
			}
			// A broadcast to every pipe client may arrive first; it is not the answer.
			reply(JSON.stringify({ jsonrpc: "2.0", method: "notifications/takeover", params: {} }));
			mcpLib.dispatchMessage(line, reply);
		});
		const link = primary.createLink({ readDiscovery: () => server.discovery });
		try {
			await until(() => link.isConnected(), "the link");
			assert.deepEqual(await reloadOver(link, file), { err: null, titles: [TITLE] });
			assert.strictEqual($tw.wiki.getTiddlerText(TITLE), "relayed");
		} finally {
			link.close();
			await server.close();
		}
	});
});

test("with no MCP server running nothing is sent", async () => {
	const link = primary.createLink({ readDiscovery: () => null });
	try {
		assert.deepEqual(await reloadOver(link, "/any/probe.tid"), { err: null, titles: undefined });
	} finally {
		link.close();
	}
});

test("a discovery file naming this very process is not linked to", async () => {
	const link = primary.createLink({ readDiscovery: () => ({ pid: process.pid, pipe: pipeName(), token: TOKEN }) });
	try {
		assert.strictEqual(link.isConnected(), false);
		assert.deepEqual(await reloadOver(link, "/any/probe.tid"), { err: null, titles: undefined });
	} finally {
		link.close();
	}
});

test("an error from the MCP server is reported", async () => {
	const server = await fakeMcpServer((message, reply) => {
		if(message.id !== undefined) {
			reply(JSON.stringify({ jsonrpc: "2.0", id: message.id, error: { code: -32603, message: "Could not read it" } }));
		}
	});
	const link = primary.createLink({ readDiscovery: () => server.discovery });
	try {
		await until(() => link.isConnected(), "the link");
		assert.strictEqual((await reloadOver(link, "/any/probe.tid")).err.message, "Could not read it");
	} finally {
		link.close();
		await server.close();
	}
});

test("an MCP server that does not answer is given up on", async () => {
	const server = await fakeMcpServer(() => {});
	const link = primary.createLink({ readDiscovery: () => server.discovery, timeoutMs: 50 });
	try {
		await until(() => link.isConnected(), "the link");
		assert.match((await reloadOver(link, "/any/probe.tid")).err.message, /did not answer/);
	} finally {
		link.close();
		await server.close();
	}
});

test("the link notices the MCP server go and links again when one comes back", async () => {
	let discovery = null;
	const logged = [],
		first = await fakeMcpServer(() => {});
	discovery = first.discovery;
	const link = primary.createLink({ readDiscovery: () => discovery, log: (line) => logged.push(line), pollMs: 20 });
	let second = null;
	try {
		await until(() => link.isConnected(), "the first link");
		discovery = null;
		first.dropClients();
		await until(() => !link.isConnected(), "the server to be gone");
		assert.ok(logged.includes("MCP server gone: PID " + first.discovery.pid + " @sse-primary"), logged.join("\n"));
		second = await fakeMcpServer(() => {});
		discovery = Object.assign({}, second.discovery, { pid: process.pid + 2, label: undefined, listen: false, port: undefined });
		await until(() => link.isConnected(), "the second link");
		assert.ok(logged.includes("MCP server found: PID " + (process.pid + 2) + ", no browser"), logged.join("\n"));
	} finally {
		link.close();
		await first.close();
		if(second) {
			await second.close();
		}
	}
});

test("the MCP server keeps what an LSP process said until its connection closes", () => {
	const hello = { jsonrpc: "2.0", method: "wikilabs.tw-mcp/lspHello", params: { pid: 4242, transport: "pipe", wiki: "/w", client: "Probe Editor", _meta: { "wikilabs.tw-mcp/auth": TOKEN } } };
	assert.strictEqual(mcpLib.handlePipeNotification("pipe-test", hello), true);
	try {
		assert.deepEqual(mcpLib.listLspClients(), [{ pid: 4242, transport: "pipe", wiki: "/w", client: "Probe Editor" }]);
		assert.strictEqual(mcpLib.handlePipeNotification("pipe-test", { jsonrpc: "2.0", method: "notifications/initialized", params: {} }), false);
	} finally {
		mcpLib.forgetPipeClient("pipe-test");
	}
	assert.deepEqual(mcpLib.listLspClients(), []);
});

test("get_wiki_info lists the LSP server in this process and the ones editors started", () => {
	const getWikiInfo = loadHandler($tw, "$:/core/modules/commands/inspect/handlers/query/get_wiki_info.js").get_wiki_info;
	$tw.mcp = { role: "primary", version: "test.0", pid: 99999, lspClients: () => [{ pid: 4242, transport: "pipe", label: "lsp-probe", wiki: "/w", client: "Probe Editor" }] };
	$tw.lsp = { pid: 99999, transport: "socket", port: 6009, label: "lsp-here" };
	try {
		const text = getWikiInfo({}).content[0].text;
		assert.match(text, /LSP: socket port 6009 \(PID 99999, this process\) @lsp-here/);
		assert.match(text, /LSP: pipe for Probe Editor \(PID 4242\) @lsp-probe on \/w/);
	} finally {
		delete $tw.mcp;
		delete $tw.lsp;
	}
});

// Test scaffolding: a wiki folder whose .tw-mcp/connect names this process as a dev server.
function withConnectFile(data, fn) {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tw-lsp-connect-")),
		saved = { wikiPath: $tw.boot.wikiPath, httpServer: $tw.httpServer };
	fs.mkdirSync(path.join(dir, ".tw-mcp"));
	fs.writeFileSync(path.join(dir, ".tw-mcp", "connect"), JSON.stringify(Object.assign({ pid: process.pid, pipe: pipeName(), token: TOKEN }, data)));
	$tw.boot.wikiPath = dir;
	delete $tw.httpServer;
	try {
		fn();
	} finally {
		$tw.boot.wikiPath = saved.wikiPath;
		$tw.httpServer = saved.httpServer;
		fs.rmSync(dir, { recursive: true, force: true });
	}
}

test("a shadow links to the browser on the dev server's port", () => {
	const source = loadHandler($tw, "$:/core/modules/commands/inspect/lsp/lsp-source.js");
	withConnectFile({ listen: true, port: 8888 }, () => {
		assert.strictEqual(source.browsableUri("$:/core/macros/toc"), "http://127.0.0.1:8888/#%24%3A%2Fcore%2Fmacros%2Ftoc");
	});
});

test("a dev server that records no port gets no browser link", () => {
	const source = loadHandler($tw, "$:/core/modules/commands/inspect/lsp/lsp-source.js");
	withConnectFile({ listen: true }, () => {
		assert.strictEqual(source.browsableUri("$:/core/macros/toc"), null);
	});
	withConnectFile({ listen: false, port: 8888 }, () => {
		assert.strictEqual(source.browsableUri("$:/core/macros/toc"), null);
	});
});

test("initialize names the editor to onInitialized, and a save hands the document to onSaved", () => {
	const saves = [],
		clients = [],
		session = lspLib.createSession(() => {}, {
			onInitialized: (client) => clients.push(client),
			onSaved: (uri, reloaded) => saves.push([uri, reloaded])
		});
	session.dispatch({ jsonrpc: "2.0", id: 1, method: "initialize", params: { clientInfo: { name: "Probe Editor", version: "1.0" } } });
	session.dispatch({ jsonrpc: "2.0", method: "textDocument/didSave", params: { textDocument: { uri: "file:///elsewhere/readme.md" } } });
	assert.deepEqual(clients, ["Probe Editor 1.0"]);
	assert.deepEqual(saves, [["file:///elsewhere/readme.md", null]]);
});
