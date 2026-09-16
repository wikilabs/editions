"use strict";

/*
Pins the one rule that makes --mcp and --lsp safe to put on the same command
line: they may share a process, but not stdio. MCP frames its messages with
newlines and LSP counts bytes in a Content-Length header, so a shared stdin
would hand each of them the other's bytes.

Both commands carry the guard, so the order they are listed in cannot matter.
These tests call the command's execute() on its refusal paths only, which
return a message before any socket or pipe is opened. To replicate by hand:

  tiddlywiki ./wiki --mcp --lsp stdio      # refused by lsp.js
  tiddlywiki ./wiki --lsp stdio --mcp      # refused by mcp.js
*/

const { test, before, afterEach } = require("node:test");
const assert = require("node:assert");
const { bootTw, loadHandler } = require("../setup");

const LSP_COMMAND = "$:/core/modules/commands/lsp.js";
const MCP_COMMAND = "$:/core/modules/commands/mcp.js";

let $tw;
let LspCommand;
let McpCommand;

before(async () => {
	$tw = await bootTw();
	LspCommand = loadHandler($tw, LSP_COMMAND).Command;
	McpCommand = loadHandler($tw, MCP_COMMAND).Command;
});

// Both guards read process-wide state that a command would otherwise set at
// startup, so each test states it and this clears it.
afterEach(() => {
	delete $tw.mcp;
	delete $tw.lsp;
});

function run(Command, params) {
	return new Command(params, { wiki: $tw.wiki }, function() {}).execute();
}

test("--lsp stdio is refused when an MCP server already owns stdio", () => {
	$tw.mcp = { pid: process.pid };
	const result = run(LspCommand, ["stdio"]);
	assert.equal(typeof result, "string", "expected a refusal message, got " + JSON.stringify(result));
	assert.ok(result.includes("--lsp stdio cannot run beside --mcp"), result);
});

test("--mcp is refused when an LSP server already owns stdio", () => {
	$tw.lsp = { transport: "stdio" };
	const result = run(McpCommand, []);
	assert.equal(typeof result, "string", "expected a refusal message, got " + JSON.stringify(result));
	assert.ok(result.includes("--mcp cannot run beside --lsp stdio"), result);
});

test("--lsp refuses stdio and pipe= together", () => {
	const result = run(LspCommand, ["stdio", "pipe=probe"]);
	assert.equal(typeof result, "string", "expected a refusal message, got " + JSON.stringify(result));
	assert.ok(result.includes("stdio or pipe=<name>, not both"), result);
});

// port=0 is valid (any free port), so it is not among these.
test("a port outside the valid range is refused before anything listens", () => {
	assert.ok(run(LspCommand, ["port=-1"]).includes("between 0 (any free port) and 65535"));
	assert.ok(run(LspCommand, ["port=70000"]).includes("between 0 (any free port) and 65535"));
	assert.ok(run(LspCommand, ["port=abc"]).includes("between 0 (any free port) and 65535"));
});
