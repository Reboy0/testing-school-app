/**
 * OpenCards suite «Валідація» (prefix VAL), browser level: each form, fed an
 * invalid value through the real UI and the real API, shows the error beside
 * the field it belongs to, marks that field invalid, and does not move on.
 * Accounts are created per case and removed afterwards (fixtures.ts).
 */
import { expect, test } from "./fixtures";
import type { Locator, Page } from "@playwright/test";
import { createAccount, uniqueEmail } from "./plan-helpers";

/** The error list a control points at through aria-describedby. */
async function errorFor(page: Page, control: Locator): Promise<Locator> {
  await expect(control).toHaveAttribute("aria-invalid", "true");
  return page.locator(`#${await control.getAttribute("aria-describedby")}`);
}

test.describe("registration form", () => {
  for (const [email, why] of [
    ["plainaddress", "no @"],
    ["ada@", "no domain"],
    ["ada@example", "no top-level domain"],
    ["ada example@example.com", "a space"],
  ]) {
    test(`VAL-17: the email ${JSON.stringify(email)} (${why}) is reported beside the email field and nothing is created`, async ({ page }) => {
      await page.goto("/register");
      await page.getByLabel("Email address").fill(email);
      await page.getByLabel("Name").fill("Ada");
      await page.getByLabel("Password").fill("Abcdefghi1");
      await page.getByRole("button", { name: "Create account" }).click();

      await expect(await errorFor(page, page.getByLabel("Email address"))).toHaveText("Enter a valid email address");
      await expect(page).toHaveURL("/register");
    });
  }

  for (const [password, message] of [
    ["Abcdefgh1", "Password must be at least 10 characters"],
    ["abcdefghi1", "Password must contain an uppercase letter"],
    ["ABCDEFGHI1", "Password must contain a lowercase letter"],
    ["Abcdefghij", "Password must contain a digit"],
  ]) {
    test(`VAL-17: the password ${JSON.stringify(password)} is reported beside the password field: ${message}`, async ({ page }) => {
      await page.goto("/register");
      await page.getByLabel("Email address").fill(uniqueEmail("val-password"));
      await page.getByLabel("Name").fill("Ada");
      await page.getByLabel("Password").fill(password);
      await page.getByRole("button", { name: "Create account" }).click();

      await expect(await errorFor(page, page.getByLabel("Password"))).toContainText(message);
      await expect(page).toHaveURL("/register");
    });
  }

  test("VAL-17: an empty form reports email, name and password, each beside its own field", async ({ page }) => {
    await page.goto("/register");
    await page.getByRole("button", { name: "Create account" }).click();

    for (const label of ["Email address", "Name", "Password"]) {
      await expect(await errorFor(page, page.getByLabel(label))).not.toBeEmpty();
    }
  });
});

test("VAL-17: sign-in and forgot-password report an invalid email beside the email field", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email address").fill("not-an-email");
  await page.getByLabel("Password").fill("anything");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(await errorFor(page, page.getByLabel("Email address"))).toHaveText("Enter a valid email address");

  await page.goto("/forgot-password");
  await page.getByLabel("Email address").fill("not-an-email");
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(await errorFor(page, page.getByLabel("Email address"))).toHaveText("Enter a valid email address");
  await expect(page.getByText(/reset link is on its way/)).toHaveCount(0);
});

test("VAL-17: the profile form reports a too-short phone and an empty name beside their fields", async ({ page }) => {
  await createAccount(page.request, "val-profile");
  await page.goto("/profile");

  await page.getByLabel("Name").fill("");
  await page.getByLabel("Phone").fill("123");
  await page.getByRole("button", { name: "Save", exact: true }).click();

  await expect(await errorFor(page, page.getByLabel("Phone"))).toHaveText("Enter a valid phone number");
  await expect(await errorFor(page, page.getByLabel("Name"))).toHaveText("Name is required");
});

test("VAL-17: the address form reports every empty field and a bad country code beside each, and saves nothing", async ({ page }) => {
  await createAccount(page.request, "val-address");
  await page.goto("/profile");
  // Reached by name: the address inputs have no labels (USER-05).
  const field = (name: string) => page.locator(`form [name="${name}"]`);

  await field("country").fill("UKR");
  await page.getByRole("button", { name: "Save address" }).click();

  for (const name of ["label", "line1", "city", "postalCode"]) {
    await expect(await errorFor(page, field(name))).not.toBeEmpty();
  }
  await expect(await errorFor(page, field("country"))).toHaveText("Use a two-letter country code");
  await expect(page.getByRole("button", { name: "Delete" })).toHaveCount(0);
});
