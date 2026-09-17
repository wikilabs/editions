"use strict";

/*
Pins what a READONLY PROXY decides about a message before relaying it.

A proxy front-end forwards every client message to the primary that holds the
wiki. When it runs readonly it must refuse a write tool call ITSELF, because the
primary is readwrite and would happily perform it. The refusal is therefore the
only thing standing between a readonly client and a write, and nothing exercised
it until this file: relayToPrimary is a closure inside startProxyMode, and the
default dev config is readwrite (bead tw-mcp-server-5hd, fix in -7m7).

classifyOutbound is that decision, lifted out as a pure function so it can be
driven here the way test/protocol/dispatch.test.js drives dispatchMessage. It
reports what the caller must remember (`track`), whether to stop (`block`) and
the refusal to send back (`response`); applying those is the caller's job.

To replicate by hand, boot the test edition and call it:

  const lib = $tw.modules.execute("$:/core/modules/commands/inspect/mcp/mcp-lib.js");
  const handlers = $tw.modules.execute("$:/core/modules/commands/inspect/mcp-handlers.js");
  lib.classifyOutbound(
    {jsonrpc:"2.0",id:1,method:"tools/call",params:{name:"put_tiddler"}},
    {readonly:true,writeToolNames:handlers.getWriteToolNames()}
  );
  // -> { track: null, block: true, response: '{"jsonrpc":"2.0","id":1,...}' }
*/

const { test, before } = require("node:test");
const assert = require("node:assert");
const { bootTw, loadHandler } = require("../setup");

const LIB_TITLE = "$:/core/modules/commands/inspect/mcp/mcp-lib.js";
const HANDLERS_TITLE = "$:/core/modules/commands/inspect/mcp-handlers.js";

const PROTOCOL = "2026-07-28";
const META_VERSION = "io.modelcontextprotocol/protocolVersion";
const META_SERVER_INFO = "io.modelcontextprotocol/serverInfo";

let classifyOutbound;
let writeToolNames;

before(async () => {
	const $tw = await bootTw();
	classifyOutbound = loadHandler($tw, LIB_TITLE).classifyOutbound;
	// The real set, not a stub: the write flag lives on each handler's own
	// definition, so a tool that stops declaring `write` fails a test here.
	writeToolNames = loadHandler($tw, HANDLERS_TITLE).getWriteToolNames();
});

// A client request, tagged with the era it speaks.
function call(toolName, era) {
	const params = { name: toolName, arguments: {} };
	if(era !== "legacy") {
		params._meta = {};
		params._meta[META_VERSION] = PROTOCOL;
	}
	return { jsonrpc: "2.0", id: 7, method: "tools/call", params: params };
}

function classify(msg, readonly) {
	return classifyOutbound(msg, { readonly: readonly, writeToolNames: writeToolNames });
}

test("a readonly proxy blocks a write tool call and answers the refusal itself", () => {
	const decision = classify(call("put_tiddler"), true);
	assert.equal(decision.block, true, "a write call must not reach the primary");
	assert.ok(decision.response, "blocking without an answer would hang the client");
	const reply = JSON.parse(decision.response);
	assert.equal(reply.id, 7, "the refusal must answer the request that was made");
	assert.equal(reply.result.isError, true);
	assert.match(reply.result.content[0].text, /put_tiddler/, "the refusal names the tool it refused");
	assert.match(reply.result.content[0].text, /readonly/i);
});

test("every advertised write tool is blocked, not just the ones named here", () => {
	// The guard against a new write tool arriving with no refusal behind it.
	const names = Object.keys(writeToolNames);
	assert.ok(names.length > 0, "the handler registry must advertise write tools at all");
	for(const name of names) {
		assert.equal(classify(call(name), true).block, true, name + " must be blocked in readonly mode");
	}
});

test("the refusal is shaped for the era the client speaks", () => {
	// It is OUR answer, not the primary's, so nothing else stamps it: a modern
	// client that gets no resultType has to guess whether more is coming.
	const modern = JSON.parse(classify(call("put_tiddler"), true).response);
	assert.equal(modern.result.resultType, "complete");
	assert.equal(modern.result._meta[META_SERVER_INFO].name, "tiddlywiki-mcp");
	const legacy = JSON.parse(classify(call("put_tiddler", "legacy"), true).response);
	assert.equal(legacy.result.resultType, undefined, "the handshake era carries no resultType");
	assert.equal(legacy.result._meta, undefined);
});

test("a read tool call is relayed untouched", () => {
	const decision = classify(call("get_tiddler"), true);
	assert.equal(decision.block, false);
	assert.equal(decision.response, null);
});

test("a write tool call is relayed when the proxy is not readonly", () => {
	const decision = classify(call("put_tiddler"), false);
	assert.equal(decision.block, false, "a readwrite proxy must forward writes");
	assert.equal(decision.response, null);
});

test("a tool name nothing advertises is relayed, so the primary names it", () => {
	// Refusing here would hide an unknown tool behind a readonly message.
	assert.equal(classify(call("no_such_tool"), true).block, false);
});

test("a tools/call with no tool name is relayed, so the primary rejects it", () => {
	const msg = { jsonrpc: "2.0", id: 8, method: "tools/call", params: {} };
	assert.equal(classify(msg, true).block, false);
});

test("tools/list is tracked in readonly mode, so its answer can be filtered", () => {
	const msg = { jsonrpc: "2.0", id: 9, method: "tools/list", params: {} };
	assert.equal(classify(msg, true).track, "toolsList");
	assert.equal(classify(msg, true).block, false, "the request itself still goes to the primary");
});

test("tools/list is not tracked when the proxy is readwrite", () => {
	// Nothing to filter out of the answer, so nothing to remember.
	const msg = { jsonrpc: "2.0", id: 9, method: "tools/list", params: {} };
	assert.equal(classify(msg, false).track, null);
});

test("server/discover and initialize are tracked in either mode", () => {
	// Their answers get the proxy's own origin written into them.
	const discover = { jsonrpc: "2.0", id: 1, method: "server/discover" };
	const initialize = { jsonrpc: "2.0", id: 2, method: "initialize", params: {} };
	assert.equal(classify(discover, true).track, "discover");
	assert.equal(classify(discover, false).track, "discover");
	assert.equal(classify(initialize, true).track, "initialize");
	assert.equal(classify(initialize, false).track, "initialize");
});

test("a notification is relayed and tracked as nothing", () => {
	// No id means no answer is coming, so there is nothing to intercept.
	const msg = { jsonrpc: "2.0", method: "notifications/initialized", params: {} };
	const decision = classify(msg, true);
	assert.equal(decision.track, null);
	assert.equal(decision.block, false);
});

test("an unparseable line is relayed, so the primary rejects it", () => {
	// parseJsonRpc hands null over; classifying it as a write would be a guess.
	const decision = classify(null, true);
	assert.equal(decision.track, null);
	assert.equal(decision.block, false);
	assert.equal(decision.response, null);
});
