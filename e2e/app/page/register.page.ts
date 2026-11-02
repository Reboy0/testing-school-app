import { expect } from "@playwright/test";
import type { User } from "../../api";
import { AppPage } from "../abstractClasses";

export class Register extends AppPage {
  readonly path = "/register";

  private readonly emailInput = this.page.getByLabel("Email address");
  private readonly nameInput = this.page.getByLabel("Name");
  private readonly passwordInput = this.page.getByLabel("Password");
  private readonly submitBtn = this.page.getByRole("button", { name: "Create account" });

  async expectLoaded(message?: string) {
    await expect(this.page, message).toHaveURL("/register");
  }

  // --- Actions ---
  async fill(user: Partial<User>) {
    if (user.email !== undefined) await this.emailInput.fill(user.email);
    if (user.name !== undefined) await this.nameInput.fill(user.name);
    if (user.password !== undefined) await this.passwordInput.fill(user.password);
  }

  async submit() {
    await this.submitBtn.click();
  }

  /** Registers through the form, checks the API accepted it and that the browser landed home. */
  async register(user: User) {
    await this.fill(user);
    await this.expectApiSuccess("POST", /^\/auth\/register$/, () => this.submit());
    await expect(this.page).toHaveURL("/");
  }

  // --- Assertions ---
  async expectEmailError(text: string) {
    await expect(await this.fieldErrorOf(this.emailInput)).toHaveText(text);
  }

  async expectPasswordError(text: string) {
    await expect(await this.fieldErrorOf(this.passwordInput)).toContainText(text);
  }

  /** The password field is invalid and announces the message to assistive technology. */
  async expectPasswordDescribedAs(text: string) {
    await expect(await this.fieldErrorOf(this.passwordInput)).toContainText(text);
    await expect(this.passwordInput).toHaveAccessibleDescription(new RegExp(text));
  }

  async expectEveryFieldReported() {
    for (const control of [this.emailInput, this.nameInput, this.passwordInput]) {
      await expect(await this.fieldErrorOf(control)).not.toBeEmpty();
    }
  }
}
