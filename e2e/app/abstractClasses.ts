import { expect, type Locator, type Response } from "@playwright/test";
import type { LoadableComponent } from "./declaration/loadable";
import { Header } from "./component/header.component";
import { PageHolder } from "./pageHolder";

export { Component, PageHolder } from "./pageHolder";

/**
 * A page of the application. Every page knows its path and how to confirm it
 * has loaded, and shares the site header and the form conventions of the
 * app: a form-level message is the main region's alert, and a field-level one
 * is the text the field points at through aria-describedby.
 */
export abstract class AppPage extends PageHolder implements LoadableComponent {
  abstract readonly path: string;
  abstract expectLoaded(message?: string): Promise<void>;

  readonly header = new Header(this.page);
  protected readonly main = this.page.getByRole("main");
  private readonly formAlert = this.main.getByRole("alert");

  /** Navigates here and waits until the page is the one expected. */
  async open(): Promise<void> {
    await this.page.goto(this.path);
    await this.expectLoaded();
  }

  /** Navigates here without asserting where the browser ends up (redirects, 404s). */
  async visit(): Promise<Response | null> {
    return this.page.goto(this.path);
  }

  async reload(): Promise<void> {
    await this.page.reload();
  }

  async expectUrl(url: string | RegExp): Promise<void> {
    await expect(this.page).toHaveURL(url);
  }

  async expectFormError(text: string): Promise<void> {
    await expect(this.formAlert).toHaveText(text);
  }

  /** Asserts the control is marked invalid and returns the error text it points at. */
  protected async fieldErrorOf(control: Locator): Promise<Locator> {
    await expect(control).toHaveAttribute("aria-invalid", "true");
    return this.page.locator(`#${await control.getAttribute("aria-describedby")}`);
  }

  /** Clicks `trigger` and asserts the request it sends to `path` succeeds. */
  protected async expectApiSuccess(method: string, path: RegExp, trigger: () => Promise<void>): Promise<void> {
    const [response] = await Promise.all([
      this.page.waitForResponse((res) => path.test(new URL(res.url()).pathname) && res.request().method() === method),
      trigger(),
    ]);
    expect(response.ok(), `${method} ${response.url()} answered ${response.status()}`).toBeTruthy();
  }
}
