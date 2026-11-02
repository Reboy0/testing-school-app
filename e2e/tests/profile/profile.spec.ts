/**
 * Profile and addresses (suite PROF, plan rows E-USER-01…03). The browser
 * starts signed in through the API; the database is checked as well as the page.
 */
import { expect, test } from "../../fixture/test";
import { getAddresses, getUserByEmail } from "../../db";

const HOME = { label: "Home", line1: "1 Main St", city: "Kyiv", postalCode: "01001", country: "UA" };
const WORK = { label: "Work", line1: "2 Khreshchatyk", city: "Lviv", postalCode: "79000", country: "UA" };

test("PROF-010 E-USER-01: a new name and phone saved on /profile are there after a reload, and the header shows the new name", async ({ app, createdUser, db }) => {
  await app.profile.open();

  await app.profile.saveProfile({ name: "Grace Hopper", phone: "+380501234567" });
  await app.profile.expectSaved();
  await expect.poll(async () => getUserByEmail(db, createdUser.email)).toMatchObject({ name: "Grace Hopper", phone: "+380501234567" });

  await app.profile.reload();
  await app.profile.expectProfile({ name: "Grace Hopper", phone: "+380501234567" });
  await app.header.expectSignedInAs("Grace Hopper");
  await app.header.expectNotSignedInAs(createdUser.name);
});

test("PROF-022 E-USER-02: add two addresses, make the second the default, delete the first — the list and the Default mark are right after each step", async ({ app, createdUser, db }) => {
  await app.profile.open();

  await app.profile.addAddress(HOME);
  await app.profile.expectAddressCount(1);
  await app.profile.expectDefault("Home");

  await app.profile.addAddress(WORK);
  await app.profile.expectAddressCount(2);
  await app.profile.expectSingleDefault();
  await expect.poll(async () => getAddresses(db, createdUser.email)).toEqual([
    { label: "Home", isDefault: true },
    { label: "Work", isDefault: false },
  ]);

  await app.profile.makeDefault("Work");
  await app.profile.expectDefault("Work");

  await app.profile.deleteAddress("Home");
  await app.profile.expectOnlyAddress("Work");
  await app.profile.expectDefault("Work");
});

test("PROF-026 E-USER-03: there is no separate addresses page — /addresses is a 404", async ({ app }) => {
  const res = await app.goto("/addresses");

  expect(res?.status()).toBe(404);
});
