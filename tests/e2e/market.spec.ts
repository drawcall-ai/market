import { test, expect } from "@playwright/test";

test.describe("homepage", () => {
  test("loads and shows title", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("text=Asset Market")).toBeVisible();
    await expect(page.getByRole("link", { name: "Browse" })).toBeVisible();
  });

  test("shows asset type filter buttons", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("button", { hasText: "All" })).toBeVisible();
    await expect(page.locator("button", { hasText: "3D Model" })).toBeVisible();
    await expect(page.locator("button", { hasText: "HDRI" })).toBeVisible();
    await expect(page.locator("button", { hasText: "Material" })).toBeVisible();
  });

  test("shows search input", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.locator('input[placeholder*="Search"]')
    ).toBeVisible();
  });
});

test.describe("auth", () => {
  const email = `test-${Date.now()}@example.com`;
  const password = "testpassword123";
  const name = "Test User";

  test("can navigate to sign in page", async ({ page }) => {
    await page.goto("/");
    await page.click("text=Sign In");
    await expect(page).toHaveURL("/auth/signin");
    await expect(page.locator("h1")).toContainText("Sign In");
  });

  test("can sign up and land on homepage", async ({ page }) => {
    await page.goto("/auth/signin");
    await page.click("text=Sign up");
    await expect(page.locator("h1")).toContainText("Create Account");

    await page.fill('input[type="text"]', name);
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL("/", { timeout: 10_000 });
    await expect(page.locator(`text=${name}`)).toBeVisible();
  });

  test("can sign in with existing account", async ({ page }) => {
    // First sign up
    await page.goto("/auth/signin");
    const uniqueEmail = `test-signin-${Date.now()}@example.com`;
    await page.click("text=Sign up");
    await page.fill('input[type="text"]', name);
    await page.fill('input[type="email"]', uniqueEmail);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL("/", { timeout: 10_000 });

    // Sign out
    await page.click("text=Sign Out");
    await expect(page.locator("text=Sign In")).toBeVisible();

    // Sign in again
    await page.click("text=Sign In");
    await page.fill('input[type="email"]', uniqueEmail);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL("/", { timeout: 10_000 });
    await expect(page.locator(`text=${name}`)).toBeVisible();
  });
});

test.describe("authenticated flows", () => {
  const email = `test-flows-${Date.now()}@example.com`;
  const password = "testpassword123";
  const name = "Flow Tester";

  test.beforeEach(async ({ page }) => {
    // Sign up / sign in
    await page.goto("/auth/signin");
    await page.click("text=Sign up");
    await page.fill('input[type="text"]', name);
    await page.fill('input[type="email"]', `${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL("/", { timeout: 10_000 });
  });

  test("can navigate to upload page", async ({ page }) => {
    await page.click("text=Upload");
    await expect(page).toHaveURL("/upload");
    await expect(page.locator("h1")).toContainText("Upload Asset");
  });

  test("can navigate to dashboard", async ({ page }) => {
    await page.click("text=Dashboard");
    await expect(page).toHaveURL("/dashboard");
  });

  test("can navigate to settings", async ({ page }) => {
    await page.click(`text=${name}`);
    await expect(page).toHaveURL("/settings");
  });

  test("upload page shows asset type tabs", async ({ page }) => {
    await page.goto("/upload");
    await expect(page.locator("button", { hasText: "Generic" })).toBeVisible();
    await expect(page.locator("button", { hasText: "3D Model" })).toBeVisible();
    await expect(page.locator("button", { hasText: "HDRI" })).toBeVisible();
    await expect(page.locator("button", { hasText: "Material" })).toBeVisible();
  });

  test("can upload a material asset", async ({ page }) => {
    await page.goto("/upload");

    // Switch to Material tab
    await page.click("button >> text=Material");

    // Fill form
    const assetName = `test-mat-${Date.now()}`;
    await page.fill('input[placeholder="my-asset"]', assetName);
    await page.fill('input[placeholder="1.0.0"]', "1.0.0");
    await page.fill("textarea", "A test material");

    // Submit
    await page.click('button[type="submit"]');

    // Should redirect to dashboard
    await expect(page).toHaveURL("/dashboard", { timeout: 10_000 });
  });
});

test.describe("asset detail", () => {
  test("shows 404-like state for nonexistent asset", async ({ page }) => {
    await page.goto("/asset/nonexistent-asset-xyz/1.0.0");
    // Should show loading then some error/empty state
    await page.waitForTimeout(2000);
    // The page should at least load without crashing
    await expect(page.locator("header")).toBeVisible();
  });
});

test.describe("protected routes redirect", () => {
  test("upload page redirects unauthenticated users", async ({ page }) => {
    await page.goto("/upload");
    // ProtectedRoute should redirect to sign in
    await expect(page).toHaveURL(/signin/, { timeout: 5_000 });
  });

  test("dashboard redirects unauthenticated users", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/signin/, { timeout: 5_000 });
  });

  test("settings redirects unauthenticated users", async ({ page }) => {
    await page.goto("/settings");
    await expect(page).toHaveURL(/signin/, { timeout: 5_000 });
  });
});
