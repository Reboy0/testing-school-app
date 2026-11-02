import type { Page } from "@playwright/test";

/** The page background in each theme: the canvas token is white in light and rgb(2, 6, 23) in dark. */
export const BACKGROUND = { light: "rgb(255, 255, 255)", dark: "rgb(2, 6, 23)" } as const;

export const background = (page: Page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor);

export const themeAttribute = (page: Page) => page.evaluate(() => document.documentElement.dataset.theme);

/** Stores a theme choice before any page script runs, as a returning visitor would have. */
export async function storeTheme(page: Page, theme: "light" | "dark"): Promise<void> {
  await page.addInitScript((value) => window.localStorage.setItem("theme", value), theme);
}

/** Records the theme the instant <body> exists — before anything inside it can have been painted. */
export async function recordThemeAtFirstPaint(page: Page): Promise<() => Promise<string | undefined>> {
  await page.addInitScript(() => {
    new MutationObserver((_, observer) => {
      if (!document.body) return;
      (window as unknown as { themeAtBody?: string }).themeAtBody = document.documentElement.dataset.theme ?? "none";
      observer.disconnect();
    }).observe(document, { childList: true, subtree: true });
  });
  return () => page.evaluate(() => (window as unknown as { themeAtBody?: string }).themeAtBody);
}
