import { expect } from "@playwright/test";
import { AppPage } from "../abstractClasses";
import { ProductBrowser } from "../component/product-browser.component";

export class Home extends AppPage {
  readonly path = "/";
  readonly products = new ProductBrowser(this.page);

  private readonly logInLink = this.main.getByRole("link", { name: "Log in" });
  private readonly createAccountLink = this.main.getByRole("link", { name: "Create an account" });
  private readonly profileLink = this.main.getByRole("link", { name: "Your profile" });
  private readonly greeting = (name: string) => this.page.getByRole("heading", { name: `Welcome back, ${name}` });

  async expectLoaded(message?: string) {
    await expect(this.page, message).toHaveURL("/");
    await expect(this.main).toBeVisible();
  }

  async followLogIn() {
    await this.logInLink.click();
  }

  async followCreateAccount() {
    await this.createAccountLink.click();
  }

  async followProfile() {
    await this.profileLink.click();
  }

  async expectGreeting(name: string) {
    await expect(this.greeting(name)).toBeVisible();
  }
}
