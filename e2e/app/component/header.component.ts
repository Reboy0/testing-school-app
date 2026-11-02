import { expect, type Locator } from "@playwright/test";
import { Component } from "../pageHolder";

/** The site header: navigation, the cart badge, the session controls and the theme toggle. */
export class Header extends Component {
  protected readonly root = this.page.getByRole("banner");

  private readonly catalogueLink = this.root.getByRole("link", { name: "Catalogue" });
  private readonly cartLink = this.root.getByRole("link", { name: /^Cart/ });
  private readonly loginLink = this.root.getByRole("link", { name: "Login" });
  private readonly signOutBtn = this.root.getByRole("button", { name: "Sign out" });
  private readonly themeToggle = this.root.getByRole("button", { name: /Switch to the (dark|light) theme/ });
  private readonly userLink = (name: string) => this.root.getByRole("link", { name });

  // --- Actions ---
  async openCatalogue() {
    await this.catalogueLink.click();
  }

  async openCart() {
    await this.cartLink.click();
  }

  async openProfileByName(name: string) {
    await this.userLink(name).click();
  }

  async signOut() {
    await this.signOutBtn.click();
    await this.expectGuest();
  }

  async switchThemeTo(theme: "light" | "dark") {
    await this.root.getByRole("button", { name: `Switch to the ${theme} theme` }).click();
  }

  // --- Assertions ---
  async expectCartCount(count: number) {
    await expect(this.cartLink).toHaveText(`Cart (${count})`);
  }

  async expectGuest() {
    await expect(this.loginLink).toBeVisible();
  }

  async expectNoSignOut() {
    await expect(this.signOutBtn).toHaveCount(0);
  }

  async expectSignedInAs(name: string) {
    await expect(this.userLink(name)).toBeVisible();
  }

  async expectNotSignedInAs(name: string) {
    await expect(this.userLink(name)).toHaveCount(0);
  }

  async expectSignOutOffered() {
    await expect(this.signOutBtn).toBeVisible();
  }

  async expectThemeToggle() {
    await expect(this.themeToggle).toBeVisible();
  }

  /** The parts the layout check needs on every width. */
  landmarks(): [string, Locator][] {
    return [
      ["header", this.root],
      ["cart badge", this.cartLink],
      ["theme toggle", this.themeToggle],
    ];
  }
}
