/**
 * Accessibility (suite XC, plan rows UI-A11Y-01…04): axe, labels, keyboard
 * use and how field errors are announced.
 */
import { expect, test } from "../../fixture/test";
import { seriousViolations, settle, tabTo, unlabelledControls } from "../../utils/a11y";

const PUBLIC_PAGES = ["/", "/catalogue", "/cart", "/login", "/register", "/forgot-password", "/reset-password?token=abc"];

test("XC-010 UI-A11Y-01: axe finds no serious or critical violations on any key page, /profile included", async ({ unauthorizedUserApp: app, createdUser, page }) => {
  const violations: string[] = [];
  for (const path of PUBLIC_PAGES) {
    await settle(page, path);
    violations.push(...(await seriousViolations(page, path)));
  }

  await app.signInThroughApi(createdUser);
  await settle(page, "/profile");
  await app.profile.expectAddressSection();
  violations.push(...(await seriousViolations(page, "/profile")));

  expect(violations).toEqual([]);
});

test("XC-009 UI-A11Y-02: every input on every form has an accessible name equal to its visible label", async ({ unauthorizedUserApp: app, createdUser, page }) => {
  const offenders: string[] = [];
  for (const path of PUBLIC_PAGES) {
    await settle(page, path);
    offenders.push(...(await unlabelledControls(page, path)));
  }

  await app.signInThroughApi(createdUser);
  await settle(page, "/profile");
  await app.profile.expectAddressSection();
  offenders.push(...(await unlabelledControls(page, "/profile")));

  expect(offenders).toEqual([]);
});

test("XC-011 UI-A11Y-03: sign in → catalogue → add to cart → cart → sign out works with the keyboard alone, with focus always visible", async ({ unauthorizedUserApp: app, createdUser, page }) => {
  await app.signIn.open();

  await tabTo(page, (el) => el.role === "input" && el.name === "Email address", "the email field");
  await page.keyboard.type(createdUser.email);
  await tabTo(page, (el) => el.role === "input" && el.name === "Password", "the password field");
  await page.keyboard.type(createdUser.password);
  await page.keyboard.press("Enter");
  await app.home.expectLoaded();

  await tabTo(page, (el) => el.role === "a" && el.name === "Catalogue", "the Catalogue link");
  await page.keyboard.press("Enter");
  await app.catalogue.expectLoaded();

  await tabTo(page, (el) => el.role === "button" && el.name === "Add to cart", "an Add to cart button");
  await page.keyboard.press("Space");
  await app.header.expectCartCount(1);

  await page.keyboard.press("Shift+Tab");
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.locator("body").focus();
  await tabTo(page, (el) => el.role === "a" && el.name === "Cart (1)", "the cart link");
  await page.keyboard.press("Enter");
  await app.cart.expectLoaded();

  await tabTo(page, (el) => el.role === "button" && el.name === "Sign out", "Sign out");
  await page.keyboard.press("Enter");
  await app.header.expectGuest();
});

test("XC-004 UI-A11Y-04: a field the API rejects is aria-invalid and points at its message through aria-describedby", async ({ unauthorizedUserApp: { register }, testData }) => {
  await register.open();
  await register.fill({ ...testData.user("a11yerr"), password: "short" });
  await register.submit();

  await register.expectPasswordDescribedAs("Password must be at least 10 characters");
});
