import { expect } from "@playwright/test";
import type { User } from "../../api";
import { AppPage } from "../abstractClasses";

export class SignIn extends AppPage {
  readonly path = "/login";

  private readonly emailInput = this.page.getByLabel("Email address");
  private readonly passwordInput = this.page.getByLabel("Password");
  private readonly submitBtn = this.page.getByRole("button", { name: "Sign in" });

  async expectLoaded(message?: string) {
    await expect(this.page, message).toHaveURL(/\/login/);
  }

  /** Fills and submits the form; where the browser goes next is the caller's to assert. */
  async signIn(user: Pick<User, "email" | "password">) {
    await this.emailInput.fill(user.email);
    await this.passwordInput.fill(user.password);
    await this.submitBtn.click();
  }

  /** Opens the form, signs in and expects to land home. */
  async signInFromScratch(user: Pick<User, "email" | "password">) {
    await this.open();
    await this.signIn(user);
    await expect(this.page).toHaveURL("/");
  }

  async expectEmailError(text: string) {
    await expect(await this.fieldErrorOf(this.emailInput)).toHaveText(text);
  }
}
