import { expect } from "@playwright/test";
import { AppPage } from "../abstractClasses";

export class ResetPassword extends AppPage {
  readonly path = "/reset-password";

  private readonly newPasswordInput = this.page.getByLabel("New password");
  private readonly submitBtn = this.page.getByRole("button", { name: "Set new password" });

  async expectLoaded(message?: string) {
    await expect(this.page, message).toHaveURL(/\/reset-password/);
  }

  async openLink(link: string) {
    await this.page.goto(link);
    await this.expectLoaded();
  }

  async setNewPassword(password: string) {
    await this.newPasswordInput.fill(password);
    await this.submitBtn.click();
  }
}
