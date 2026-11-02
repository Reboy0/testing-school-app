import type { Locator, Page } from "@playwright/test";

/** Holds the Playwright page: the base of everything that touches the browser. */
export abstract class PageHolder {
  constructor(protected readonly page: Page) {}
}

/** A part of a page with its own locators, scoped to a root element. */
export abstract class Component extends PageHolder {
  protected abstract readonly root: Locator;
}
