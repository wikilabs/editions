// @ts-check
const { test, expect } = require("@playwright/test");

// A procedure defined in the tiddler that calls it points at its own lines there (bead tw-mcp-server-nlm).
test("a local procedure's output points at its definition in the tiddler", async ({ page }) => {
	await page.goto("/#local-procedure");
	const span = page.locator("[data-tiddler-title='local-procedure'] .local-hello");
	await expect(span).toHaveAttribute("data-pos", "L4 @ local-procedure");
});
