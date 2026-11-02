/**
 * The home page (suite HP, plan rows E-HOME-01…03).
 */
import { expect, test } from "../../fixture/test";
import type { Application } from "../../app";

test("HP-002 E-HOME-01: a guest on / follows the sign-in and registration links to /login and /register", async ({ unauthorizedUserApp: app }) => {
  await app.home.open();
  await app.home.followLogIn();
  await app.signIn.expectUrl("/login");

  await app.home.open();
  await app.home.followCreateAccount();
  await app.register.expectLoaded();
});

test("HP-004 E-HOME-02: a signed-in user on / is greeted by name, and the link goes to /profile", async ({ app, createdUser }) => {
  await app.home.expectGreeting(createdUser.name);

  await app.home.followProfile();

  await app.profile.expectUrl("/profile");
});

test("HP-008 E-HOME-03: search, filter, sort and paging on / behave like /catalogue and show the same products", async ({ unauthorizedUserApp: app }) => {
  async function browse(at: Application["home"] | Application["catalogue"]) {
    await at.visit();
    await at.products.expectProductsLoaded();
    await at.products.search("e");
    await at.products.sortBy("price_desc");
    await at.products.expectOnPage(1);
    await at.products.nextPage();
    await at.products.expectOnPage(2);
    return { names: await at.products.cardNames(), indicator: await at.products.pageLabel() };
  }

  const home = await browse(app.home);
  const catalogue = await browse(app.catalogue);

  expect(home.names.length).toBeGreaterThan(0);
  expect(home).toEqual(catalogue);
});
