import { expect, type Locator } from "@playwright/test";
import { AppPage } from "../abstractClasses";

export class Cart extends AppPage {
  readonly path = "/cart";

  private readonly heading = this.page.getByRole("heading", { name: "Your cart" });
  private readonly emptyMessage = this.page.getByText("Your cart is empty");
  private readonly totalRows = this.main.locator("dl > div");
  private readonly row = (name: string): Locator => this.main.locator("ul > li").filter({ has: this.page.getByText(name, { exact: true }) });
  private readonly quantity = (name: string) => this.row(name).locator("span.min-w-4");

  async expectLoaded(message?: string) {
    await expect(this.page, message).toHaveURL("/cart");
    await expect(this.heading).toBeVisible();
  }

  // --- Actions ---
  async increase(name: string, expectedQuantity: number) {
    await this.row(name).getByRole("button", { name: `Add one more ${name}` }).click();
    await this.expectQuantity(name, expectedQuantity);
  }

  async decrease(name: string, expectedQuantity: number) {
    await this.row(name).getByRole("button", { name: `Remove one ${name}` }).click();
    await this.expectQuantity(name, expectedQuantity);
  }

  /** The application has no checkout yet (FLOW-OQ-01); this is what one would look like. */
  async checkout() {
    await this.main.getByRole("button", { name: /checkout|place order/i }).click({ timeout: 3000 });
  }

  async remove(name: string) {
    await this.row(name).getByRole("button", { name: `Remove ${name} from the cart` }).click();
  }

  // --- Reading ---
  async totals(): Promise<Record<string, string>> {
    const totals: Record<string, string> = {};
    for (const row of await this.totalRows.all()) {
      totals[(await row.locator("dt").textContent()) ?? ""] = ((await row.locator("dd").textContent()) ?? "").replace("−", "");
    }
    return totals;
  }

  /** The sum of every line's quantity for a product, however many lines it is split across. */
  async totalQuantityOf(name: string): Promise<number> {
    return (await this.quantity(name).allTextContents()).reduce((sum, quantity) => sum + Number(quantity), 0);
  }

  // --- Assertions ---
  async expectLine(name: string) {
    await expect(this.row(name)).toBeVisible();
  }

  async expectLineCount(name: string, count: number) {
    await expect(this.row(name)).toHaveCount(count);
  }

  async expectQuantity(name: string, quantity: number) {
    await expect(this.quantity(name)).toHaveText(String(quantity));
  }

  async expectLineText(name: string, text: string) {
    await expect(this.row(name)).toContainText(text);
  }

  async expectTotal(total: string) {
    expect((await this.totals()).Total).toBe(total);
  }

  async expectTotals(totals: Record<string, string>) {
    expect(await this.totals()).toEqual(totals);
  }

  async expectOrderConfirmed() {
    await expect(this.page.getByText(/order (placed|confirmed)/i)).toBeVisible();
  }

  async expectEmpty() {
    await expect(this.emptyMessage).toBeVisible();
  }
}
