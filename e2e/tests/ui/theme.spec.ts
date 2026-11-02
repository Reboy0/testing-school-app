/**
 * Themes (suite TH, plan rows UI-THEME-01…06). The theme in force is read
 * off the page background.
 */
import { expect, test } from "../../fixture/test";
import { contrastViolations, settle } from "../../utils/a11y";
import { withIds } from "../../utils/ids";
import { BACKGROUND, background, recordThemeAtFirstPaint, storeTheme, themeAttribute } from "../../utils/theme";

for (const [id, scheme] of withIds("TH-004", "TH-005", ["dark", "light"] as const)) {
  test(`${id} UI-THEME-01: with nothing stored, the page follows a ${scheme} operating-system scheme`, async ({ unauthorizedUserApp: app, page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await app.home.open();

    expect(await background(page)).toBe(BACKGROUND[scheme]);
    expect(await themeAttribute(page)).toBeUndefined();
  });
}

test("TH-006 UI-THEME-02: the header offers the theme toggle to a guest and to a signed-in user", async ({ unauthorizedUserApp: app, createdUser }) => {
  await app.home.open();
  await app.header.expectThemeToggle();

  await app.signInThroughApi(createdUser);
  await app.home.reload();
  await app.header.expectSignOutOffered();
  await app.header.expectThemeToggle();
});

for (const [id, plan, system, chosen] of withIds("TH-008", "TH-009", [
  ["UI-THEME-03", "light", "dark"],
  ["UI-THEME-04", "dark", "light"],
] as const)) {
  test(`${id} ${plan}: on a ${system} system, choosing ${chosen} holds across navigation, a reload and a new page`, async ({ unauthorizedUserApp: app, page, context }) => {
    await page.emulateMedia({ colorScheme: system });
    await app.home.open();
    await app.header.switchThemeTo(chosen);
    expect(await background(page)).toBe(BACKGROUND[chosen]);

    await app.header.openCatalogue();
    await app.catalogue.expectUrl("/catalogue");
    expect(await background(page)).toBe(BACKGROUND[chosen]);

    await app.catalogue.reload();
    expect(await background(page)).toBe(BACKGROUND[chosen]);

    const later = await context.newPage();
    await later.emulateMedia({ colorScheme: system });
    await later.goto("/login");
    expect(await background(later)).toBe(BACKGROUND[chosen]);
  });
}

test("TH-010 UI-THEME-05: a stored dark theme is applied before the first paint on a light system", async ({ unauthorizedUserApp: app, page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await storeTheme(page, "dark");
  const themeAtFirstPaint = await recordThemeAtFirstPaint(page);

  await app.catalogue.visit();

  expect(await themeAtFirstPaint()).toBe("dark");
  expect(await background(page)).toBe(BACKGROUND.dark);
});

for (const [id, theme] of withIds("TH-012", "TH-013", ["light", "dark"] as const)) {
  test(`${id} UI-THEME-06: key pages pass axe's colour-contrast check in the ${theme} theme`, async ({ page }) => {
    await storeTheme(page, theme);
    const violations: string[] = [];

    for (const path of ["/", "/catalogue", "/cart", "/login", "/register", "/forgot-password"]) {
      await settle(page, path);
      violations.push(...(await contrastViolations(page, path)));
    }

    expect(violations).toEqual([]);
  });
}
