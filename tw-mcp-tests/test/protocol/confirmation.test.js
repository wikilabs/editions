"use strict";

/*
Pins the MRTR confirmation gate on bulk writes.

replace_in_tiddlers takes a filter, so its blast radius is invisible in its
arguments. The gate resolves the filter first and asks the user about the
RESOLVED set, via an elicitation carried in an InputRequiredResult. The client
must retry the call with the answer and the echoed requestState before
anything is written.

To replicate by hand: seed two tiddlers containing a token, then call
replace_in_tiddlers with dry_run:false and _meta declaring elicitation
support. The first reply writes nothing and asks; the retry applies.
*/

const { test, before } = require("node:test");
const assert = require("node:assert");
const { bootTw, loadHandler, cleanupTiddler } = require("../setup");

const LIB_TITLE = "$:/core/modules/commands/inspect/mcp/mcp-lib.js";
const PROTOCOL = "2026-07-28";
const META_VERSION = "io.modelcontextprotocol/protocolVersion";
const META_CAPS = "io.modelcontextprotocol/clientCapabilities";
const CONFIRM_KEY = "confirm_bulk_write";
// Distinctive so the default filter cannot pull in edition fixtures.
const TOKEN = "ZZQCONFIRMTOKEN";
const TITLES = ["confirm_probe_a", "confirm_probe_b"];

let dispatchMessage;
let $tw;

before(async () => {
	$tw = await bootTw({ ownFolder: true });
	dispatchMessage = loadHandler($tw, LIB_TITLE).dispatchMessage;
});

function seed(titles) {
	titles.forEach((t) => $tw.wiki.addTiddler({ title: t, text: "before " + TOKEN + " after" }));
}

function cleanup(titles) {
	titles.forEach((t) => cleanupTiddler($tw, t));
}

// One tools/call for replace_in_tiddlers. opts.elicitation=false drops the
// capability; opts.inputResponses / opts.requestState drive the retry.
function call(opts) {
	const o = opts || {};
	const params = {
		name: "replace_in_tiddlers",
		arguments: { rules: [{ pattern: TOKEN, replacement: "REPLACED" }], dry_run: o.dryRun === true },
		_meta: {}
	};
	params._meta[META_VERSION] = PROTOCOL;
	if(o.elicitation !== false) {
		params._meta[META_CAPS] = { elicitation: {} };
	}
	if(o.inputResponses) params.inputResponses = o.inputResponses;
	if(o.requestState) params.requestState = o.requestState;
	let captured = null;
	dispatchMessage(
		JSON.stringify({ jsonrpc: "2.0", id: o.id || 1, method: "tools/call", params }),
		(out) => { captured = out; }
	);
	return JSON.parse(captured).result;
}

function accept(value) {
	const responses = {};
	responses[CONFIRM_KEY] = { action: "accept", content: { confirm: value } };
	return responses;
}

test("a bulk apply asks before writing, and writes nothing yet", () => {
	seed(TITLES);
	try {
		const result = call({});
		assert.equal(result.resultType, "input_required");
		const request = result.inputRequests[CONFIRM_KEY];
		assert.equal(request.method, "elicitation/create");
		assert.match(request.params.message, /2 tiddlers/);
		assert.ok(result.requestState, "an opaque requestState must be returned");
		// The whole point: the first call is not destructive.
		TITLES.forEach((t) => assert.match($tw.wiki.getTiddlerText(t), new RegExp(TOKEN)));
	} finally {
		cleanup(TITLES);
	}
});

test("retrying with the confirmation and the echoed state applies the change", () => {
	seed(TITLES);
	try {
		const asked = call({ id: 1 });
		const applied = call({
			id: 2, // a retry is an independent request, so the id differs
			inputResponses: accept(true),
			requestState: asked.requestState
		});
		assert.equal(applied.resultType, "complete");
		TITLES.forEach((t) => assert.match($tw.wiki.getTiddlerText(t), /REPLACED/));
	} finally {
		cleanup(TITLES);
	}
});

test("declining the confirmation writes nothing", () => {
	seed(TITLES);
	try {
		const asked = call({ id: 1 });
		const declined = call({
			id: 2,
			inputResponses: accept(false),
			requestState: asked.requestState
		});
		assert.equal(declined.isError, true);
		assert.match(declined.content[0].text, /cancelled/);
		TITLES.forEach((t) => assert.match($tw.wiki.getTiddlerText(t), new RegExp(TOKEN)));
	} finally {
		cleanup(TITLES);
	}
});

test("a tampered requestState is refused and the gate asks again", () => {
	seed(TITLES);
	try {
		const asked = call({ id: 1 });
		const forged = call({
			id: 2,
			inputResponses: accept(true),
			requestState: asked.requestState.slice(0, -4) + "0000"
		});
		// Asking again, rather than applying, is the safe failure.
		assert.equal(forged.resultType, "input_required");
		TITLES.forEach((t) => assert.match($tw.wiki.getTiddlerText(t), new RegExp(TOKEN)));
	} finally {
		cleanup(TITLES);
	}
});

test("a client that cannot be asked is not gated", () => {
	// The spec forbids sending an elicitation to a client that has not declared
	// support for it, so there is no way to ask and behaviour is unchanged.
	seed(TITLES);
	try {
		const result = call({ elicitation: false });
		assert.equal(result.resultType, "complete");
		TITLES.forEach((t) => assert.match($tw.wiki.getTiddlerText(t), /REPLACED/));
	} finally {
		cleanup(TITLES);
	}
});

test("a change narrow enough to see in the arguments is not gated", () => {
	// The threshold exists to catch unintended breadth. One tiddler is not that.
	seed([TITLES[0]]);
	try {
		const result = call({});
		assert.equal(result.resultType, "complete");
		assert.match($tw.wiki.getTiddlerText(TITLES[0]), /REPLACED/);
	} finally {
		cleanup([TITLES[0]]);
	}
});

test("a dry run is never gated, since it writes nothing", () => {
	seed(TITLES);
	try {
		const result = call({ dryRun: true });
		assert.equal(result.resultType, "complete");
		TITLES.forEach((t) => assert.match($tw.wiki.getTiddlerText(t), new RegExp(TOKEN)));
	} finally {
		cleanup(TITLES);
	}
});
