// @ts-check
const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

// devtools ships tw-mcp-core's source-position module through tiddlywiki.files
// (bead tw-mcp-server-5tl); tw-mcp-tests checks the same from the MCP side.
const TITLE = "$:/plugins/wikilabs/shared/sourcepos.js";

function coreFile() {
	for(const dir of (process.env.TIDDLYWIKI_PLUGIN_PATH || "").split(path.delimiter)) {
		const candidate = path.resolve(dir, "wikilabs", "tw-mcp-core", "tiddlers", "shared", "sourcepos.js");
		if(dir && fs.existsSync(candidate)) return candidate;
	}
	throw new Error("tw-mcp-core's sourcepos.js not found below TIDDLYWIKI_PLUGIN_PATH");
}

test("devtools ships tw-mcp-core's source-position module unchanged", async ({ page }) => {
	await page.goto("/");
	const shipped = await page.evaluate((title) => window["$tw"].wiki.getPluginInfo("$:/plugins/wikilabs/devtools").tiddlers[title].text, TITLE);
	expect(shipped).toBe(fs.readFileSync(coreFile(), "utf8"));
});
