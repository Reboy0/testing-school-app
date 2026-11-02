import { expect, type APIRequestContext } from "@playwright/test";
import { env } from "../env";

export interface User {
  email: string;
  name: string;
  password: string;
}

export interface Product {
  id: string;
  name: string;
  priceCents: number;
}

/**
 * The API, driven through a Playwright request context. Given a page's own
 * context (`page.request`) the session cookies land in that browser, which
 * is how the fixtures sign a browser in without the login form.
 */
export class ApiClient {
  constructor(private readonly request: APIRequestContext) {}

  private url(path: string) {
    return `${env.API_URL}${path}`;
  }

  async register(user: User): Promise<void> {
    const res = await this.request.post(this.url("/auth/register"), { data: user });
    expect(res.status(), await res.text()).toBe(201);
  }

  async signIn(user: Pick<User, "email" | "password">): Promise<void> {
    const res = await this.request.post(this.url("/auth/login"), { data: user });
    expect(res.status(), await res.text()).toBe(200);
  }

  async refresh(): Promise<number> {
    return (await this.request.post(this.url("/auth/refresh"))).status();
  }

  async forgotPassword(email: string): Promise<void> {
    await this.request.post(this.url("/auth/forgot-password"), { data: { email } });
  }

  async resetPassword(token: string, password: string): Promise<number> {
    return (await this.request.post(this.url("/auth/reset-password"), { data: { token, password } })).status();
  }

  async findProduct(query: string): Promise<Product> {
    const body = await (await this.request.get(this.url(`/products?q=${encodeURIComponent(query)}`))).json();
    expect(body.items.length, `no product matches "${query}"`).toBeGreaterThan(0);
    return body.items[0];
  }

  async productCount(): Promise<number> {
    return (await (await this.request.get(this.url("/products"))).json()).total;
  }

  /** Every product the API holds for a query, across all of its pages. */
  async allProducts(query = ""): Promise<Product[]> {
    const items: Product[] = [];
    for (let page = 1; page < 50; page += 1) {
      const body = await (await this.request.get(this.url(`/products?${query}${query ? "&" : ""}page=${page}`))).json();
      if (body.items.length === 0) break;
      items.push(...body.items);
    }
    return items;
  }

  async addToCart(productId: string, quantity = 1): Promise<void> {
    const res = await this.request.post(this.url("/cart/items"), { data: { productId, quantity } });
    expect(res.ok(), await res.text()).toBe(true);
  }
}
