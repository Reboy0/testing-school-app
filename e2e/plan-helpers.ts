import { expect, type APIRequestContext, type Locator, type Page } from "@playwright/test";

export const API_URL = process.env.API_URL ?? "http://localhost:4000";
export const PASSWORD = "Password123!";

let sequence = 0;

/** Every address handed out during the current case, so the fixture in fixtures.ts can delete those accounts afterwards. */
export const createdEmails: string[] = [];

/** A unique address per call, so no test touches the seeded accounts or another test's. */
export function uniqueEmail(tag: string): string {
  sequence += 1;
  const email = `e2e-${tag}-${Date.now()}-${sequence}@example.com`;
  createdEmails.push(email);
  return email;
}

export interface Account {
  email: string;
  name: string;
  password: string;
}

/**
 * Creates an account through the API. Given a page's own request context the
 * session cookies land in that browser context, so the page is signed in;
 * given a standalone one, the account exists but the browser is untouched.
 */
export async function createAccount(api: APIRequestContext, tag: string, name = "E2E User"): Promise<Account> {
  const account = { email: uniqueEmail(tag), name: `${name} ${sequence}`, password: PASSWORD };
  const res = await api.post(`${API_URL}/auth/register`, { data: account });
  expect(res.status(), await res.text()).toBe(201);
  return account;
}

export async function signInThroughForm(page: Page, account: Pick<Account, "email" | "password">): Promise<void> {
  await page.getByLabel("Email address").fill(account.email);
  await page.getByLabel("Password").fill(account.password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

export async function signIn(page: Page, account: Pick<Account, "email" | "password">): Promise<void> {
  await page.goto("/login");
  await signInThroughForm(page, account);
  await expect(page).toHaveURL("/");
}

export const header = (page: Page) => page.getByRole("banner");
export const cartLink = (page: Page) => header(page).getByRole("link", { name: /^Cart/ });

/** The product cards on the page. */
export const cards = (page: Page) => page.locator("main ul.grid > li");
export const card = (page: Page, name: string) => cards(page).filter({ has: page.getByRole("heading", { name, exact: true }) });

export async function cardNames(page: Page): Promise<string[]> {
  return cards(page).getByRole("heading").allTextContents();
}

/** The list price on each card: the struck-through one on a sale item, the only one otherwise. */
export async function listPricesCents(page: Page): Promise<number[]> {
  const toCents = (text: string) => Math.round(Number(text.replace(/[^0-9.]/g, "")) * 100);
  const prices: number[] = [];
  for (const item of await cards(page).all()) {
    const struck = item.locator("s");
    const text = (await struck.count()) > 0 ? await struck.first().textContent() : await item.locator("p span").first().textContent();
    prices.push(toCents(text ?? ""));
  }
  return prices;
}

export async function waitForProducts(page: Page): Promise<void> {
  await expect(page.getByText(/^Page \d+ of \d+$/)).toBeVisible();
}

export const pageIndicator = (page: Page) => page.getByText(/^Page \d+ of \d+$/);

/** Every product name the API holds for a query, across all of its pages. */
export async function allProductsFromApi(api: APIRequestContext, query = ""): Promise<{ name: string; priceCents: number }[]> {
  const items: { name: string; priceCents: number }[] = [];
  for (let page = 1; page < 50; page += 1) {
    const res = await api.get(`${API_URL}/products?${query}${query ? "&" : ""}page=${page}`);
    const body = await res.json();
    if (body.items.length === 0) break;
    items.push(...body.items);
  }
  return items;
}

/** The cart row for a product on /cart. */
export const cartRow = (page: Page, name: string): Locator =>
  page.locator("main ul > li").filter({ has: page.getByText(name, { exact: true }) });

export async function cartTotals(page: Page): Promise<Record<string, string>> {
  const totals: Record<string, string> = {};
  for (const row of await page.locator("main dl > div").all()) {
    totals[(await row.locator("dt").textContent()) ?? ""] = ((await row.locator("dd").textContent()) ?? "").replace("−", "");
  }
  return totals;
}

const MAILDEV_URL = process.env.MAILDEV_URL ?? "http://localhost:1080";

interface MaildevMessage {
  to: { address: string }[];
  text?: string;
}

/** The newest reset link Maildev holds for one address. */
export async function resetLinkFor(email: string): Promise<string> {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    const messages = (await (await fetch(`${MAILDEV_URL}/email`)).json()) as MaildevMessage[];
    const mine = messages.filter((message) => message.to.some((to) => to.address === email));
    const match = /https?:\/\/\S+\/reset-password\?token=[0-9a-f]+/.exec(mine.at(-1)?.text ?? "");
    if (match) return match[0];
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`No reset email for ${email} within 15s`);
}
