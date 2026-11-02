/**
 * Registration (OpenCards suite REG, plan rows E-AUTH-01…02) and the legacy
 * sign-up check LOGIN-070. Every account is new and removed afterwards.
 */
import { test } from "../../fixture/test";
import { Tag } from "../../tags";

test("REG-003 E-AUTH-01: registering through /register lands on / with the new name in the header", { tag: Tag.Smoke }, async ({ unauthorizedUserApp: app, testData }) => {
  const user = testData.user("register");

  await app.register.open();
  await app.register.register(user);

  await app.header.expectSignedInAs(user.name);
});

test("REG-011 E-AUTH-02: a weak password and then a taken email are each reported, and the page stays on /register", async ({ unauthorizedUserApp: app, createdUser, testData }) => {
  await app.register.open();
  await app.register.fill({ ...testData.user("weak"), password: "short" });
  await app.register.submit();

  await app.register.expectPasswordError("Password must be at least 10 characters");
  await app.register.expectLoaded();

  await app.register.fill({ email: createdUser.email, password: createdUser.password });
  await app.register.submit();

  await app.register.expectFormError("That email is already registered");
  await app.register.expectLoaded();
});

test("LOGIN-070: register and land on the home page", async ({ unauthorizedUserApp: app, testData }) => {
  await app.register.open();
  await app.register.register(testData.user("new"));

  await app.home.expectLoaded();
});
