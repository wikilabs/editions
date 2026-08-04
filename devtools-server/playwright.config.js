// @ts-check
const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
	testDir: "./tests",
	timeout: 30000,
	expect: {
		toHaveScreenshot: {
			maxDiffPixelRatio: 0.01
		}
	},
	use: {
		baseURL: "http://localhost:8099",
		viewport: { width: 1280, height: 800 },
		channel: "msedge"
	},
	webServer: {
		// Pinned core, not the global `tiddlywiki` command: that is a junction
		// into the TW5 working copy, so the screenshot tests below would
		// compare against whatever happens to be checked out there.
		// TW_CORE=dev overrides this for a run against TiddlyWiki master.
		command: "node ../scripts/tw.js --core release . --listen port=8099 host=127.0.0.1",
		port: 8099,
		reuseExistingServer: false,
		timeout: 20000
	}
});
