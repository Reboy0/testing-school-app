import { expect } from "@playwright/test";
import { RESET_CONFIRMATION } from "../../data";
import { AppPage } from "../abstractClasses";

export class ForgotPassword extends AppPage {
  readonly path = "/forgot-password";

  private readonly emailInput = this.page.getByLabel("Email address");
  private readonly submitBtn = this.page.getByRole("button", { name: "Send reset link" });
  private readonly confirmation = this.page.getByText(RESET_CONFIRMATION);

  async expectLoaded(message?: string) {
    await expect(this.page, message).toHaveURL("/forgot-password");
  }

  async requestReset(email: string) {
    await this.emailInput.fill(email);
    await this.submitBtn.click();
  }

  async expectConfirmation() {
    await expect(this.confirmation).toBeVisible();
  }

  async expectNoConfirmation() {
    await expect(this.page.getByText(/reset link is on its way/)).toHaveCount(0);
  }

  async expectEmailError(text: string) {
    await expect(await this.fieldErrorOf(this.emailInput)).toHaveText(text);
  }
}
