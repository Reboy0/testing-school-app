/**
 * End-to-end cases E-AUTH-01 … E-AUTH-10 from docs/test-plan.md §6.1.
 * Every case works on an account of its own, never on the seeded ones.
 */
import { expect, test } from "./fixtures";
import { API_URL, createAccount, header, resetLinkFor, signIn, signInThroughForm, uniqueEmail } from "./plan-helpers";

test("REG-003 E-AUTH-01: registering through /register lands on / with the new name in the header", async ({ page }) => {
  const email = uniqueEmail("register");

  await page.goto("/register");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Name").fill("Ada Lovelace");
  await page.getByLabel("Password").fill("Abcdefghi1");
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page).toHaveURL("/");
  await expect(header(page).getByRole("link", { name: "Ada Lovelace" })).toBeVisible();
});

test("REG-011 E-AUTH-02: a weak password and then a taken email are each reported, and the page stays on /register", async ({ page, request }) => {
  const taken = await createAccount(request, "taken");

  await page.goto("/register");
  await page.getByLabel("Email address").fill(uniqueEmail("weak"));
  await page.getByLabel("Name").fill("Ada");
  await page.getByLabel("Password").fill("short");
  await page.getByRole("button", { name: "Create account" }).click();

  const password = page.getByLabel("Password");
  await expect(password).toHaveAttribute("aria-invalid", "true");
  await expect(page.locator("#password-error")).toContainText("Password must be at least 10 characters");
  await expect(page).toHaveURL("/register");

  await page.getByLabel("Email address").fill(taken.email);
  await password.fill("Abcdefghi1");
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page.getByRole("main").getByRole("alert")).toHaveText("That email is already registered");
  await expect(page).toHaveURL("/register");
});

test("LOGIN-007 E-AUTH-03: after signing in, /profile survives a reload still signed in", async ({ page, request }) => {
  const account = await createAccount(request, "reload");
  await signIn(page, account);

  await page.goto("/profile");
  await expect(page.getByText(account.email)).toBeVisible();
  await page.reload();

  await expect(page.getByText(account.email)).toBeVisible();
  await expect(page).toHaveURL("/profile");
});

test("LOGIN-013 E-AUTH-04: a wrong password shows an error and stays on the sign-in page", async ({ page, request }) => {
  const account = await createAccount(request, "wrong");

  await page.goto("/login");
  await signInThroughForm(page, { email: account.email, password: "WrongPassword1" });

  await expect(page.getByRole("main").getByRole("alert")).toHaveText("Email or password is incorrect");
  await expect(page).toHaveURL("/login");
});

test("LOGIN-024 E-AUTH-05: a guest sent from /profile to sign in comes back to /profile afterwards", async ({ page, request }) => {
  const account = await createAccount(request, "return");

  await page.goto("/profile");
  await expect(page).toHaveURL(/\/login\?returnTo=%2Fprofile/);
  await signInThroughForm(page, account);

  await expect(page).toHaveURL("/profile");
});

test("PWD-004 E-AUTH-06: forgot password → email in Maildev → link → new password → the new one signs in and the old one does not", async ({ page, request }) => {
  const account = await createAccount(request, "reset");

  await page.goto("/forgot-password");
  await page.getByLabel("Email address").fill(account.email);
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByText("If that address is registered, a reset link is on its way.")).toBeVisible();

  await page.goto(await resetLinkFor(account.email));
  await page.getByLabel("New password").fill("BrandNewPass1");
  await page.getByRole("button", { name: "Set new password" }).click();
  await expect(page).toHaveURL("/login");

  await signInThroughForm(page, account);
  await expect(page.getByRole("main").getByRole("alert")).toHaveText("Email or password is incorrect");

  await signInThroughForm(page, { email: account.email, password: "BrandNewPass1" });
  await expect(page).toHaveURL("/");
});

test("PWD-010 E-AUTH-07: following the same reset link a second time is refused", async ({ page, request }) => {
  const account = await createAccount(request, "relink");
  await request.post(`${API_URL}/auth/forgot-password`, { data: { email: account.email } });
  const link = await resetLinkFor(account.email);

  await page.goto(link);
  await page.getByLabel("New password").fill("BrandNewPass1");
  await page.getByRole("button", { name: "Set new password" }).click();
  await expect(page).toHaveURL("/login");

  await page.goto(link);
  await page.getByLabel("New password").fill("SecondNewPass2");
  await page.getByRole("button", { name: "Set new password" }).click();

  await expect(page.getByRole("main").getByRole("alert")).toHaveText("This reset link is no longer valid");
  await expect(page).toHaveURL(/\/reset-password/);
});

test("PWD-012 E-AUTH-08: resetting the password in one browser ends the session in another", async ({ browser, request }) => {
  const account = await createAccount(request, "twobrowsers");
  const other = await browser.newContext();
  const otherPage = await other.newPage();
  await signIn(otherPage, account);

  await request.post(`${API_URL}/auth/forgot-password`, { data: { email: account.email } });
  const token = new URL(await resetLinkFor(account.email)).searchParams.get("token");
  const reset = await request.post(`${API_URL}/auth/reset-password`, { data: { token, password: "BrandNewPass1" } });
  expect(reset.status()).toBe(204);

  // The other browser can no longer renew its session…
  expect((await otherPage.request.post(`${API_URL}/auth/refresh`)).status()).toBe(401);
  // …so once its 15-minute access token lapses it is signed out.
  await other.clearCookies({ name: "access_token" });
  await otherPage.goto("/profile");
  await expect(otherPage).toHaveURL(/\/login/);
  await other.close();
});

test("LOGIN-028 E-AUTH-09: after Sign out, a reload and Back both show a guest, and /profile asks for sign-in again", async ({ page, request }) => {
  const account = await createAccount(request, "signout");
  await signIn(page, account);
  await page.goto("/profile");
  await expect(page.getByText(account.email)).toBeVisible();

  await header(page).getByRole("button", { name: "Sign out" }).click();
  await expect(header(page).getByRole("link", { name: "Login" })).toBeVisible();

  await page.reload();
  await expect(header(page).getByRole("link", { name: "Login" })).toBeVisible();
  await page.goBack();
  await expect(header(page).getByRole("link", { name: "Login" })).toBeVisible();
  await expect(header(page).getByRole("button", { name: "Sign out" })).toHaveCount(0);

  await page.goto("/profile");
  await expect(page).toHaveURL(/\/login/);
});

test("LOGIN-032 E-AUTH-10: clicking your name in the header opens /profile", async ({ page, request }) => {
  const account = await createAccount(request, "namelink");
  await signIn(page, account);

  await header(page).getByRole("link", { name: account.name }).click();

  await expect(page).toHaveURL("/profile");
  await expect(page.getByText(account.email)).toBeVisible();
});
