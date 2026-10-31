import { expect, test } from "@playwright/test";

const SEEDED_EMAIL = "student@example.com";
const SEEDED_PASSWORD = "Password123!";
const SEEDED_NAME = "Sam Student";
// Registration is the only thing that ever writes this address, and nothing
// removes it afterwards, so a fixed one would collide with the row left by
// the previous run and fail with 409 EMAIL_TAKEN until the next database
// reset. Deriving it from the clock keeps every run's account its own.
const NEW_ACCOUNT_EMAIL = `e2e-new-${Date.now()}@example.com`;

test("LOGIN-070: register and land on the home page", async ({ page }) => {
  await page.goto("/register");
  await page.getByLabel("Email address").fill(NEW_ACCOUNT_EMAIL);
  await page.getByLabel("Name").fill("E2E New User");
  await page.getByLabel("Password").fill("Password123!");
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page).toHaveURL("/");
});

test("LOGIN-071: sign in and reach the profile", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email address").fill(SEEDED_EMAIL);
  await page.getByLabel("Password").fill(SEEDED_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/");

  await page.goto("/profile");

  await expect(page.getByRole("heading", { name: "Profile" })).toBeVisible();
  await expect(page.getByText(SEEDED_EMAIL)).toBeVisible();
});

test("LOGIN-072: the user's name in the header leads to the profile, addresses and all", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email address").fill(SEEDED_EMAIL);
  await page.getByLabel("Password").fill(SEEDED_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/");

  await page.getByRole("banner").getByRole("link", { name: SEEDED_NAME }).click();

  await expect(page).toHaveURL("/profile");
  await expect(page.getByRole("heading", { name: "Profile" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Addresses" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Save address" })).toBeVisible();
});

test("LOGIN-073: an unauthenticated visit to /profile lands on sign-in", async ({ page }) => {
  await page.goto("/profile");

  await expect(page).toHaveURL(/\/login/);
});
