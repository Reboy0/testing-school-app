/**
 * UI cases UI-A11Y-01 … UI-A11Y-04 from docs/test-plan.md §6.7.
 */
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "../fixtures";
import type { Page } from "@playwright/test";
import { cartLink, createAccount, header, uniqueEmail } from "../plan-helpers";

const PUBLIC_PAGES = ["/", "/catalogue", "/cart", "/login", "/register", "/forgot-password", "/reset-password?token=abc"];

async function settled(page: Page, path: string) {
  await page.goto(path);
  await expect(page.getByRole("main")).toBeVisible();
  await page.waitForLoadState("networkidle");
}

async function seriousViolations(page: Page, path: string): Promise<string[]> {
  const result = await new AxeBuilder({ page }).analyze();
  return result.violations
    .filter((violation) => violation.impact === "serious" || violation.impact === "critical")
    .flatMap((violation) => violation.nodes.map((node) => `${path}: [${violation.impact}] ${violation.id} — ${node.target.join(" ")}`));
}

test("XC-03 UI-A11Y-01: axe finds no serious or critical violations on any key page, /profile included", async ({ page }) => {
  const violations: string[] = [];
  for (const path of PUBLIC_PAGES) {
    await settled(page, path);
    violations.push(...(await seriousViolations(page, path)));
  }

  await createAccount(page.request, "axe");
  await settled(page, "/profile");
  await expect(page.getByRole("heading", { name: "Addresses" })).toBeVisible();
  violations.push(...(await seriousViolations(page, "/profile")));

  expect(violations).toEqual([]);
});

test("XC-02 UI-A11Y-02: every input on every form has an accessible name equal to its visible label", async ({ page }) => {
  const offenders: string[] = [];
  const check = async (path: string) => {
    const controls = await page.getByRole("main").locator("input, select, textarea").all();
    for (const control of controls) {
      const described = await control.evaluate((element) => {
        const id = element.id;
        const label = id ? document.querySelector(`label[for="${CSS.escape(id)}"]`) : element.closest("label");
        return { name: element.getAttribute("name") ?? element.id, label: label?.textContent?.trim() ?? null };
      });
      if (!described.label) {
        offenders.push(`${path}: ${described.name} has no visible label`);
        continue;
      }
      const byLabel = page.getByLabel(described.label, { exact: true });
      if ((await byLabel.count()) !== 1 || !(await byLabel.evaluate((element, name) => (element.getAttribute("name") ?? element.id) === name, described.name))) {
        offenders.push(`${path}: ${described.name}'s accessible name is not its label "${described.label}"`);
      }
    }
  };

  for (const path of PUBLIC_PAGES) {
    await settled(page, path);
    await check(path);
  }
  await createAccount(page.request, "labels");
  await settled(page, "/profile");
  await expect(page.getByRole("button", { name: "Save address" })).toBeVisible();
  await check("/profile");

  expect(offenders).toEqual([]);
});

/** Presses Tab until the focused element matches, then checks the focus can be seen. */
async function tabTo(page: Page, matches: (element: { role: string; name: string }) => boolean, description: string) {
  for (let presses = 0; presses < 80; presses += 1) {
    await page.keyboard.press("Tab");
    const focused = await page.evaluate(() => {
      const element = document.activeElement as HTMLElement | null;
      if (!element || element === document.body) return null;
      const style = getComputedStyle(element);
      return {
        role: element.tagName.toLowerCase(),
        name: (element.getAttribute("aria-label") ?? element.textContent ?? "").trim() || (element as HTMLInputElement).labels?.[0]?.textContent?.trim() || "",
        visible: style.outlineStyle !== "none" && style.outlineColor !== "rgba(0, 0, 0, 0)" ? true : style.boxShadow !== "none",
      };
    });
    if (focused && matches(focused)) {
      expect(focused.visible, `focus on ${description} is not visible`).toBe(true);
      return;
    }
  }
  throw new Error(`Could not reach ${description} with Tab`);
}

test("XC-04 UI-A11Y-03: sign in → catalogue → add to cart → cart → sign out works with the keyboard alone, with focus always visible", async ({ page, request }) => {
  const account = await createAccount(request, "keyboard");
  await page.goto("/login");

  await tabTo(page, (el) => el.role === "input" && el.name === "Email address", "the email field");
  await page.keyboard.type(account.email);
  await tabTo(page, (el) => el.role === "input" && el.name === "Password", "the password field");
  await page.keyboard.type(account.password);
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL("/");

  await tabTo(page, (el) => el.role === "a" && el.name === "Catalogue", "the Catalogue link");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL("/catalogue");
  await expect(page.getByText(/^Page \d+ of \d+$/)).toBeVisible();

  await tabTo(page, (el) => el.role === "button" && el.name === "Add to cart", "an Add to cart button");
  await page.keyboard.press("Space");
  await expect(cartLink(page)).toHaveText("Cart (1)");

  await page.keyboard.press("Shift+Tab");
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.locator("body").focus();
  await tabTo(page, (el) => el.role === "a" && el.name === "Cart (1)", "the cart link");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL("/cart");

  await tabTo(page, (el) => el.role === "button" && el.name === "Sign out", "Sign out");
  await page.keyboard.press("Enter");
  await expect(header(page).getByRole("link", { name: "Login" })).toBeVisible();
});

test("XC-01 UI-A11Y-04: a field the API rejects is aria-invalid and points at its message through aria-describedby", async ({ page }) => {
  await page.goto("/register");
  await page.getByLabel("Email address").fill(uniqueEmail("a11yerr"));
  await page.getByLabel("Name").fill("Ada");
  await page.getByLabel("Password").fill("short");
  await page.getByRole("button", { name: "Create account" }).click();

  const password = page.getByLabel("Password");
  await expect(password).toHaveAttribute("aria-invalid", "true");
  const describedBy = await password.getAttribute("aria-describedby");
  expect(describedBy).toBeTruthy();
  await expect(page.locator(`#${describedBy}`)).toContainText("Password must be at least 10 characters");
  await expect(password).toHaveAccessibleDescription(/Password must be at least 10 characters/);
});
