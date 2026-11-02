import { expect } from "@playwright/test";
import { AppPage } from "../abstractClasses";

export interface AddressInput {
  label: string;
  line1: string;
  city: string;
  postalCode: string;
  country: string;
}

export class Profile extends AppPage {
  readonly path = "/profile";

  private readonly heading = this.page.getByRole("heading", { name: "Profile" });
  private readonly nameInput = this.page.getByLabel("Name");
  private readonly phoneInput = this.page.getByLabel("Phone");
  private readonly saveBtn = this.page.getByRole("button", { name: "Save", exact: true });
  private readonly addressesHeading = this.page.getByRole("heading", { name: "Addresses" });
  private readonly addressRows = this.addressesHeading.locator("..").locator("ul > li");
  private readonly addressRow = (label: string) => this.addressRows.filter({ hasText: label });
  private readonly defaultMarks = this.page.getByText("Default", { exact: true });
  private readonly saveAddressBtn = this.page.getByRole("button", { name: "Save address" });
  private readonly deleteBtns = this.page.getByRole("button", { name: "Delete" });
  // The address inputs are reached by name, not label: they have no labels
  // (USER-05), which XC-002/XC-009 exist to catch.
  private readonly addressField = (name: string) => this.page.locator(`form [name="${name}"]`);

  async expectLoaded(message?: string) {
    await expect(this.page, message).toHaveURL("/profile");
    await expect(this.heading).toBeVisible();
  }

  // --- Profile form ---
  async saveProfile(fields: { name?: string; phone?: string }) {
    if (fields.name !== undefined) await this.nameInput.fill(fields.name);
    if (fields.phone !== undefined) await this.phoneInput.fill(fields.phone);
    await this.saveBtn.click();
  }

  async expectSaved() {
    await expect(this.saveBtn).toBeEnabled();
  }

  async expectProfile(fields: { name: string; phone: string }) {
    await expect(this.nameInput).toHaveValue(fields.name);
    await expect(this.phoneInput).toHaveValue(fields.phone);
  }

  async expectEmail(email: string) {
    await expect(this.page.getByText(email)).toBeVisible();
  }

  async expectNameError(text: string) {
    await expect(await this.fieldErrorOf(this.nameInput)).toHaveText(text);
  }

  async expectPhoneError(text: string) {
    await expect(await this.fieldErrorOf(this.phoneInput)).toHaveText(text);
  }

  // --- Addresses ---
  async addAddress(address: Partial<AddressInput>) {
    for (const [name, value] of Object.entries(address)) await this.addressField(name).fill(value);
    await this.saveAddressBtn.click();
  }

  async makeDefault(label: string) {
    await this.addressRow(label).getByRole("button", { name: /default/i }).click({ timeout: 3000 });
  }

  async deleteAddress(label: string) {
    await this.addressRow(label).getByRole("button", { name: "Delete" }).click();
  }

  async expectAddressSection() {
    await expect(this.addressesHeading).toBeVisible();
    await expect(this.saveAddressBtn).toBeVisible();
  }

  async expectAddressCount(count: number) {
    await expect(this.addressRows).toHaveCount(count);
  }

  async expectOnlyAddress(label: string) {
    await expect(this.addressRows).toHaveCount(1);
    await expect(this.addressRows.first()).toContainText(label);
  }

  async expectDefault(label: string) {
    await expect(this.addressRow(label)).toContainText("Default");
    await expect(this.defaultMarks).toHaveCount(1);
  }

  async expectSingleDefault() {
    await expect(this.defaultMarks).toHaveCount(1);
  }

  async expectAddressFieldError(name: string, text?: string) {
    const error = await this.fieldErrorOf(this.addressField(name));
    if (text === undefined) await expect(error).not.toBeEmpty();
    else await expect(error).toHaveText(text);
  }

  async expectNoAddressesSaved() {
    await expect(this.deleteBtns).toHaveCount(0);
  }
}
