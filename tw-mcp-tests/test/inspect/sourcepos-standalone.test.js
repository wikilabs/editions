"use strict";

/*
tw-mcp-core without devtools (bead tw-mcp-server-5tl): the inspect tools install
the shared source-position patches for one call and remove them afterwards. By
hand: start `tiddlywiki <wiki> --mcp` on a wiki that lists tw-mcp-core but not
devtools, and call inspect_pos on a tiddler with a link and a code block.
*/

const { test, before } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { bootTw, loadHandler } = require("../setup");

const INSPECT = "$:/core/modules/commands/inspect/handlers/inspect/";
// Body lines 1 to 5; the .tid header (title only) adds two lines in front.
const DOC_TEXT = "see [[Alpha]] here\n\n```\ncode\n```";

let tw, inspectPos, inspectScope;

before(async () => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tw-mcp-sourcepos-"));
	process.on("exit", () => {
		// Best-effort teardown: a folder left in the temp directory harms nothing.
		try {
			fs.rmSync(dir, { recursive: true, force: true });
		} catch(err) {}
	});
	fs.mkdirSync(path.join(dir, "tiddlers"));
	fs.writeFileSync(path.join(dir, "tiddlywiki.info"), JSON.stringify({ plugins: ["wikilabs/tw-mcp-core"] }));
	fs.writeFileSync(path.join(dir, "tiddlers", "Doc.tid"), "title: Doc\n\n" + DOC_TEXT);
	tw = await bootTw({ wikiPath: dir });
	assert.ok(!tw.modules.titles["$:/plugins/wikilabs/devtools/sourcepos.js"], "this wiki must not load devtools");
	inspectPos = loadHandler(tw, INSPECT + "inspect_pos.js").inspect_pos;
	inspectScope = loadHandler(tw, INSPECT + "inspect_scope.js").inspect_scope;
});

test("inspect_pos places links and code blocks on their file lines without devtools", () => {
	const text = inspectPos({ text: DOC_TEXT, context: "Doc" }).content[0].text;
	assert.match(text, /<a[^>]*p="0:3"/);
	assert.match(text, /<pre[^>]*p="0:5-7"/);
});

test("inspect_pos announces each link once and takes the patches off afterwards", () => {
	const LinkWidget = tw.modules.execute("$:/core/modules/widgets/link.js").link;
	const renderLink = LinkWidget.prototype.renderLink;
	let links = 0;
	const countLinks = (domNode) => { links++; return domNode; };
	tw.hooks.addHook("th-dom-rendering-link", countLinks);
	try {
		inspectPos({ text: "one [[Alpha]] and two [[Beta]] links", context: "Doc" });
	} finally {
		tw.hooks.removeHook("th-dom-rendering-link", countLinks);
	}
	assert.equal(links, 2);
	assert.equal(LinkWidget.prototype.renderLink, renderLink);
	assert.equal(tw.wikilabsSourcePos.holders, 0);
});

// Pins the no-holder case of bead tw-mcp-server-mt1: a reload installs nothing when nobody holds the patches.
test("re-executing the module with no holder patches nothing", () => {
	const TITLE = "$:/plugins/wikilabs/shared/sourcepos.js";
	const LinkWidget = tw.modules.execute("$:/core/modules/widgets/link.js").link;
	const renderLink = LinkWidget.prototype.renderLink;
	// Test scaffolding: what reload_mcp_modules does to this module.
	tw.modules.titles[TITLE].exports = undefined;
	tw.modules.execute(TITLE);
	assert.equal(LinkWidget.prototype.renderLink, renderLink);
	assert.ok(!tw.wikilabsSourcePos || tw.wikilabsSourcePos.holders === 0);
});

test("inspect_scope files a core macro under used globals without devtools", () => {
	const text = inspectScope({ text: '<<list-links "[[A]]">>', charPos: 0 }).content[0].text;
	assert.match(text, /— used globals\n(.+\n)*macro list-links\(.*\) @\$:\/core\/macros\/list/);
});
