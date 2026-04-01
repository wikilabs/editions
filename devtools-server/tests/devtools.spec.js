// @ts-check
const { test, expect } = require("@playwright/test");

// Locate a tracked element inside the GettingStarted tiddler
function tracked(page) {
	return page.locator("[data-tiddler-title='GettingStarted'] [data-source-pos]").first();
}

test.beforeEach(async ({ page }) => {
	await page.goto("/#GettingStarted");
	await page.waitForSelector("[data-source-pos]", { timeout: 15000 });
});

// ── Tooltip ──

test("tooltip appears on hover", async ({ page }) => {
	await tracked(page).hover();
	const tooltip = page.locator(".wltc-tooltip");
	await tooltip.waitFor({ state: "visible", timeout: 5000 });
	await expect(tooltip).toContainText("GettingStarted");
});

test("tooltip shows caller chain", async ({ page }) => {
	await tracked(page).hover();
	await page.locator(".wltc-tooltip").waitFor({ state: "visible", timeout: 5000 });
	await expect(page.locator(".wltc-tooltip-body")).toContainText("ViewTemplate");
});

test("tooltip disappears when moving away", async ({ page }) => {
	await tracked(page).hover();
	await page.locator(".wltc-tooltip").waitFor({ state: "visible", timeout: 5000 });
	await page.locator(".tc-site-title").hover();
	await expect(page.locator(".wltc-tooltip")).not.toBeVisible({ timeout: 3000 });
});

test("tooltip visual", async ({ page }) => {
	await tracked(page).hover();
	await page.locator(".wltc-tooltip").waitFor({ state: "visible", timeout: 5000 });
	await expect(page.locator(".wltc-tooltip")).toHaveScreenshot("tooltip.png");
});

// ── Context Menu ──

test("context menu opens on right-click", async ({ page }) => {
	await tracked(page).click({ button: "right" });
	const menu = page.locator("#sourcepos-context-menu");
	await menu.waitFor({ state: "visible", timeout: 5000 });
	await expect(menu.locator(".wltc-menu-header")).toContainText("GettingStarted");
	await expect(menu.locator(".wltc-menu-item", { hasText: "Copy tiddler title" })).toBeVisible();
	await expect(menu.locator(".wltc-menu-item", { hasText: "Inspect variables" })).toBeVisible();
	await expect(menu.locator(".wltc-menu-item", { hasText: /^Open GettingStarted$/ })).toBeVisible();
	await expect(menu.locator(".wltc-menu-header .wltc-menu-btn-icon")).toHaveCount(2);
	await expect(menu.locator(".wltc-menu-item", { hasText: /Open ←/ }).first()).toBeVisible();
});

test("context menu closes on click outside", async ({ page }) => {
	await tracked(page).click({ button: "right" });
	await page.locator("#sourcepos-context-menu").waitFor({ state: "visible", timeout: 5000 });
	await page.mouse.click(10, 10);
	await expect(page.locator("#sourcepos-context-menu")).not.toBeVisible({ timeout: 3000 });
});

test("Ctrl+right-click passes through", async ({ page }) => {
	await tracked(page).click({ button: "right", modifiers: ["Control"] });
	await expect(page.locator("#sourcepos-context-menu")).not.toBeVisible();
});

test("context menu visual", async ({ page }) => {
	await tracked(page).click({ button: "right" });
	await page.locator("#sourcepos-context-menu").waitFor({ state: "visible", timeout: 5000 });
	await expect(page.locator("#sourcepos-context-menu")).toHaveScreenshot("context-menu.png");
});

// ── Source Viewer ──

test("source viewer opens and shows entry", async ({ page }) => {
	await tracked(page).click({ button: "right" });
	await page.locator("#sourcepos-context-menu").waitFor({ state: "visible", timeout: 5000 });
	// Click eye icon (second icon button in header)
	await page.locator(".wltc-menu-header .wltc-menu-btn-icon").nth(1).click();
	const viewer = page.locator("#sourcepos-source-viewer");
	await viewer.waitFor({ state: "visible", timeout: 5000 });
	await expect(page.locator(".wltc-entry-header").first()).toContainText("GettingStarted");
	const code = page.locator(".wltc-entry-code").first();
	await expect(code).toBeVisible();
	expect((await code.textContent()).length).toBeGreaterThan(0);
});

test("source viewer clear and close", async ({ page }) => {
	await tracked(page).click({ button: "right" });
	await page.locator("#sourcepos-context-menu").waitFor({ state: "visible", timeout: 5000 });
	await page.locator(".wltc-menu-header .wltc-menu-btn-icon").nth(1).click();
	await page.locator("#sourcepos-source-viewer").waitFor({ state: "visible", timeout: 5000 });
	// Clear
	await page.locator(".wltc-btn-clear").click();
	await expect(page.locator(".wltc-entry-header")).toHaveCount(0);
	// Close
	await page.locator("#sourcepos-source-viewer .wltc-btn-close").click();
	await expect(page.locator("#sourcepos-source-viewer")).not.toBeVisible();
});

test("source viewer visual", async ({ page }) => {
	await tracked(page).click({ button: "right" });
	await page.locator("#sourcepos-context-menu").waitFor({ state: "visible", timeout: 5000 });
	await page.locator(".wltc-menu-header .wltc-menu-btn-icon").nth(1).click();
	await page.locator("#sourcepos-source-viewer").waitFor({ state: "visible", timeout: 5000 });
	await expect(page.locator("#sourcepos-source-viewer")).toHaveScreenshot("source-viewer.png");
});

// ── Variable Inspector ──

test("variable inspector opens and shows variables", async ({ page }) => {
	await tracked(page).click({ button: "right" });
	await page.locator("#sourcepos-context-menu").waitFor({ state: "visible", timeout: 5000 });
	await page.locator(".wltc-menu-item", { hasText: "Inspect variables" }).click();
	const inspector = page.locator(".sourcepos-var-inspector");
	await inspector.waitFor({ state: "visible", timeout: 5000 });
	await expect(inspector.locator(".wltc-panel-header")).toContainText(/Variables in scope \(\d+\)/);
	expect(await page.locator(".wltc-var-badge").count()).toBeGreaterThan(0);
});

test("variable inspector filter works", async ({ page }) => {
	await tracked(page).click({ button: "right" });
	await page.locator("#sourcepos-context-menu").waitFor({ state: "visible", timeout: 5000 });
	await page.locator(".wltc-menu-item", { hasText: "Inspect variables" }).click();
	await page.locator(".sourcepos-var-inspector").waitFor({ state: "visible", timeout: 5000 });
	const allRows = await page.locator(".wltc-var-row").count();
	// Filter by name
	await page.locator(".wltc-inspector-filter").fill("currentTiddler");
	await page.waitForTimeout(200);
	const filtered = await page.locator(".wltc-var-row").count();
	expect(filtered).toBeLessThan(allRows);
	expect(filtered).toBeGreaterThan(0);
	// Filter by type
	await page.locator(".wltc-inspector-filter").fill("proc");
	await page.waitForTimeout(200);
	const badges = page.locator(".wltc-var-badge");
	const count = await badges.count();
	expect(count).toBeGreaterThan(0);
	for (let i = 0; i < count; i++) {
		await expect(badges.nth(i)).toHaveText("proc");
	}
	// Empty state
	await page.locator(".wltc-inspector-filter").fill("zzz_nonexistent_zzz");
	await page.waitForTimeout(200);
	await expect(page.locator(".wltc-empty-state")).toBeVisible();
});

test("variable inspector close", async ({ page }) => {
	await tracked(page).click({ button: "right" });
	await page.locator("#sourcepos-context-menu").waitFor({ state: "visible", timeout: 5000 });
	await page.locator(".wltc-menu-item", { hasText: "Inspect variables" }).click();
	await page.locator(".sourcepos-var-inspector").waitFor({ state: "visible", timeout: 5000 });
	await page.locator(".sourcepos-var-inspector .wltc-btn-close").click();
	await expect(page.locator(".sourcepos-var-inspector")).not.toBeVisible();
});

test("variable inspector visual", async ({ page }) => {
	await tracked(page).click({ button: "right" });
	await page.locator("#sourcepos-context-menu").waitFor({ state: "visible", timeout: 5000 });
	await page.locator(".wltc-menu-item", { hasText: "Inspect variables" }).click();
	await page.locator(".sourcepos-var-inspector").waitFor({ state: "visible", timeout: 5000 });
	await expect(page.locator(".sourcepos-var-inspector")).toHaveScreenshot("variable-inspector.png");
});

// ── Hover outline ──

test("element gets orange outline on hover", async ({ page }) => {
	const el = tracked(page);
	await el.hover();
	await page.waitForTimeout(100);
	const outline = await el.evaluate(el => getComputedStyle(el).outlineColor);
	expect(outline).toContain("255");
});
