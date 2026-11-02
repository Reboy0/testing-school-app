import { expect } from "@playwright/test";
import { AppPage } from "../abstractClasses";
import { ProductBrowser } from "../component/product-browser.component";

export class Catalogue extends AppPage {
  readonly path = "/catalogue";
  readonly products = new ProductBrowser(this.page);

  private readonly heading = this.page.getByRole("heading", { name: "Catalogue" });

  async expectLoaded(message?: string) {
    await expect(this.page, message).toHaveURL("/catalogue");
    await expect(this.heading).toBeVisible();
    await this.products.expectProductsLoaded();
  }

  /** Opens the catalogue, searches for a product and adds it to the cart. */
  async addToCart(name: string, search: string = name) {
    await this.open();
    await this.products.search(search);
    await this.products.addToCart(name);
  }

  /** Watches the page for "No products found" from the very first paint; returns what it saw. */
  async recordNothingFound(): Promise<boolean[]> {
    const seen: boolean[] = [];
    await this.page.exposeFunction("reportNothingFound", () => seen.push(true));
    await this.page.addInitScript(() => {
      new MutationObserver(() => {
        if (document.body?.innerText.includes("No products found")) (window as unknown as { reportNothingFound(): void }).reportNothingFound();
      }).observe(document, { subtree: true, childList: true, characterData: true });
    });
    return seen;
  }

  /** Delays every catalogue response, to watch the page while it waits. */
  async slowDownProducts(ms: number) {
    await this.page.route("**/products?**", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, ms));
      await route.continue();
    });
  }
}
