/**
 * End-to-end cases E-USER-01 … E-USER-03 from docs/test-plan.md §6.2.
 */
import { expect, test } from "./fixtures";
import type { Page } from "@playwright/test";
import { createAccount, header } from "./plan-helpers";

// The address form's controls are reached by name: USER-05 (no labels) is
// what C-USER-05 and UI-A11Y-02 exist to catch, and this case is about
// managing addresses, not about labelling them.
async function addAddress(page: Page, address: Record<string, string>) {
  for (const [name, value] of Object.entries(address)) {
    await page.locator(`form [name="${name}"]`).fill(value);
  }
  await page.getByRole("button", { name: "Save address" }).click();
}

const addressRows = (page: Page) => page.getByRole("heading", { name: "Addresses" }).locator("..").locator("ul > li");

test("PROF-03 E-USER-01: a new name and phone saved on /profile are there after a reload, and the header shows the new name", async ({ page }) => {
  const account = await createAccount(page.request, "profile");
  await page.goto("/profile");

  await page.getByLabel("Name").fill("Grace Hopper");
  await page.getByLabel("Phone").fill("+380501234567");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("button", { name: "Save", exact: true })).toBeEnabled();

  await page.reload();
  await expect(page.getByLabel("Name")).toHaveValue("Grace Hopper");
  await expect(page.getByLabel("Phone")).toHaveValue("+380501234567");
  await expect(header(page).getByRole("link", { name: "Grace Hopper" })).toBeVisible();
  await expect(header(page).getByRole("link", { name: account.name })).toHaveCount(0);
});

test("PROF-06 E-USER-02: add two addresses, make the second the default, delete the first — the list and the Default mark are right after each step", async ({ page }) => {
  await createAccount(page.request, "addresses");
  await page.goto("/profile");

  await addAddress(page, { label: "Home", line1: "1 Main St", city: "Kyiv", postalCode: "01001", country: "UA" });
  await expect(addressRows(page)).toHaveCount(1);
  await expect(addressRows(page).filter({ hasText: "Home" })).toContainText("Default");

  await addAddress(page, { label: "Work", line1: "2 Khreshchatyk", city: "Lviv", postalCode: "79000", country: "UA" });
  await expect(addressRows(page)).toHaveCount(2);
  await expect(page.getByText("Default", { exact: true })).toHaveCount(1);

  const work = addressRows(page).filter({ hasText: "Work" });
  await work.getByRole("button", { name: /default/i }).click({ timeout: 3000 });
  await expect(work).toContainText("Default");
  await expect(page.getByText("Default", { exact: true })).toHaveCount(1);

  await addressRows(page).filter({ hasText: "Home" }).getByRole("button", { name: "Delete" }).click();
  await expect(addressRows(page)).toHaveCount(1);
  await expect(addressRows(page).first()).toContainText("Work");
  await expect(addressRows(page).first()).toContainText("Default");
});

test("PROF-08 E-USER-03: there is no separate addresses page — /addresses is a 404", async ({ page }) => {
  const res = await page.goto("/addresses");

  expect(res?.status()).toBe(404);
});
