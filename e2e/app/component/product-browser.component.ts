import { expect, type Locator } from "@playwright/test";
import { Component } from "../pageHolder";

/**
 * The catalogue's search, filters, sort, product cards and paging — the same
 * component on /catalogue and on the home page.
 */
export class ProductBrowser extends Component {
  protected readonly root = this.page.getByRole("main");

  private readonly searchInput = this.root.getByLabel("Search");
  private readonly categorySelect = this.root.getByLabel("Category");
  private readonly minPriceInput = this.root.getByLabel("Lowest price (cents)");
  private readonly maxPriceInput = this.root.getByLabel("Highest price (cents)");
  private readonly sortSelect = this.root.getByLabel("Sort by");
  private readonly nextBtn = this.root.getByRole("button", { name: "Next", exact: true });
  private readonly pageIndicator = this.page.getByText(/^Page \d+ of \d+$/);
  private readonly loadingStatus = this.root.getByText("Loading…");
  private readonly cards = this.root.locator("ul.grid > li");
  private readonly card = (name: string) => this.cards.filter({ has: this.page.getByRole("heading", { name, exact: true }) });
  private readonly addBtn = (name: string) => this.card(name).getByRole("button", { name: "Add to cart" });

  // --- Actions ---
  async search(text: string) {
    await this.searchInput.fill(text);
  }

  async chooseCategory(slug: string) {
    await this.categorySelect.selectOption(slug);
  }

  async setPriceRange(minCents: string, maxCents: string) {
    await this.minPriceInput.fill(minCents);
    await this.maxPriceInput.fill(maxCents);
  }

  async sortBy(order: "name" | "price_asc" | "price_desc") {
    await this.sortSelect.selectOption(order);
  }

  async nextPage() {
    const before = await this.pageIndicator.textContent();
    await this.nextBtn.click();
    await expect(this.pageIndicator).not.toHaveText(before ?? "");
  }

  async hasNextPage(): Promise<boolean> {
    return this.nextBtn.isEnabled();
  }

  /** Adds a product and waits for the API to confirm it, not just for the click. */
  async addToCart(name: string) {
    await expect(this.card(name)).toBeVisible();
    const [response] = await Promise.all([
      this.page.waitForResponse((res) => new URL(res.url()).pathname === "/cart/items" && res.request().method() === "POST"),
      this.addBtn(name).click(),
    ]);
    expect(response.ok(), `adding ${name} answered ${response.status()}`).toBeTruthy();
    await expect(this.addBtn(name)).toBeEnabled();
  }

  // --- Reading ---
  async cardNames(): Promise<string[]> {
    return this.cards.getByRole("heading").allTextContents();
  }

  async pageLabel(): Promise<string | null> {
    return this.pageIndicator.textContent();
  }

  /** The list price on each card: the struck-through one on a sale item, the only one otherwise. */
  async listPricesCents(): Promise<number[]> {
    const toCents = (text: string) => Math.round(Number(text.replace(/[^0-9.]/g, "")) * 100);
    const prices: number[] = [];
    for (const item of await this.cards.all()) {
      const struck = item.locator("s");
      const text = (await struck.count()) > 0 ? await struck.first().textContent() : await item.locator("p span").first().textContent();
      prices.push(toCents(text ?? ""));
    }
    return prices;
  }

  // --- Assertions ---
  async expectProductsLoaded() {
    await expect(this.pageIndicator).toBeVisible();
  }

  async expectSomeProducts() {
    await expect(this.cards.first()).toBeVisible();
  }

  async expectOnPage(page: number) {
    await expect(this.pageIndicator).toHaveText(new RegExp(`^Page ${page} of`));
  }

  async expectLoading() {
    await expect(this.loadingStatus).toBeVisible();
  }

  async expectCard(name: string) {
    await expect(this.card(name)).toBeVisible();
  }

  async expectCardText(name: string, text: string | RegExp) {
    await expect(this.card(name).getByText(text)).toBeVisible();
  }

  async expectInCart(name: string, quantity: number) {
    await expect(this.card(name).getByText(`In your cart: ${quantity}`)).toBeVisible();
  }

  /** Polls until every card's name satisfies `match` — the list re-renders as filters apply. */
  async expectEveryName(match: (name: string) => boolean) {
    await expect.poll(async () => {
      const names = await this.cardNames();
      return names.length > 0 && names.every(match);
    }).toBe(true);
  }

  async expectNames(expected: string[]) {
    await expect.poll(async () => (await this.cardNames()).sort()).toEqual([...expected].sort());
  }

  async expectPricesSorted(direction: "asc" | "desc") {
    await expect.poll(async () => {
      const prices = await this.listPricesCents();
      return prices.length > 1 && prices.every((price, i) => i === 0 || (direction === "asc" ? prices[i - 1] <= price : prices[i - 1] >= price));
    }).toBe(true);
  }
}
