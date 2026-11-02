import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

/** Opens a path and waits until the page has settled, so axe sees the finished page. */
export async function settle(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await expect(page.getByRole("main")).toBeVisible();
  await page.waitForLoadState("networkidle");
}

/** axe's serious and critical violations on the current page, one line per node. */
export async function seriousViolations(page: Page, path: string): Promise<string[]> {
  const result = await new AxeBuilder({ page }).analyze();
  return result.violations
    .filter((violation) => violation.impact === "serious" || violation.impact === "critical")
    .flatMap((violation) => violation.nodes.map((node) => `${path}: [${violation.impact}] ${violation.id} — ${node.target.join(" ")}`));
}

/** axe's colour-contrast violations on the current page. */
export async function contrastViolations(page: Page, path: string): Promise<string[]> {
  const result = await new AxeBuilder({ page }).withRules(["color-contrast"]).analyze();
  return result.violations.flatMap((violation) =>
    violation.nodes.map((node) => `${path}: ${node.target.join(" ")} — ${node.failureSummary?.split("\n")[1]?.trim()}`),
  );
}

/** Every form control in main whose accessible name is not its visible label. */
export async function unlabelledControls(page: Page, path: string): Promise<string[]> {
  const offenders: string[] = [];
  for (const control of await page.getByRole("main").locator("input, select, textarea").all()) {
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
  return offenders;
}

/** Presses Tab until the focused element matches, then checks the focus can be seen. */
export async function tabTo(page: Page, matches: (element: { role: string; name: string }) => boolean, description: string): Promise<void> {
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
