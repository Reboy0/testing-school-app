/**
 * Signing in, staying signed in and signing out (suite LOGIN, plan rows
 * E-AUTH-03…05, 09, 10, and the legacy checks LOGIN-071…073). These cases
 * are about the session itself, so they go through the sign-in form rather
 * than the fixture's API sign-in.
 */
import { test } from "../../fixture/test";
import { Tag } from "../../tags";

test("LOGIN-007 E-AUTH-03: after signing in, /profile survives a reload still signed in", { tag: Tag.Smoke }, async ({ unauthorizedUserApp: app, createdUser }) => {
  await app.signIn.signInFromScratch(createdUser);

  await app.profile.open();
  await app.profile.expectEmail(createdUser.email);
  await app.profile.reload();

  await app.profile.expectEmail(createdUser.email);
  await app.profile.expectUrl("/profile");
});

test("LOGIN-013 E-AUTH-04: a wrong password shows an error and stays on the sign-in page", async ({ unauthorizedUserApp: app, createdUser }) => {
  await app.signIn.open();
  await app.signIn.signIn({ email: createdUser.email, password: "WrongPassword1" });

  await app.signIn.expectFormError("Email or password is incorrect");
  await app.signIn.expectUrl("/login");
});

test("LOGIN-024 E-AUTH-05: a guest sent from /profile to sign in comes back to /profile afterwards", async ({ unauthorizedUserApp: app, createdUser }) => {
  await app.profile.visit();
  await app.signIn.expectUrl(/\/login\?returnTo=%2Fprofile/);
  await app.signIn.signIn(createdUser);

  await app.profile.expectUrl("/profile");
});

test("LOGIN-028 E-AUTH-09: after Sign out, a reload and Back both show a guest, and /profile asks for sign-in again", async ({ app, createdUser }) => {
  await app.profile.open();
  await app.profile.expectEmail(createdUser.email);

  await app.header.signOut();

  await app.profile.reload();
  await app.header.expectGuest();
  await app.goBack();
  await app.header.expectGuest();
  await app.header.expectNoSignOut();

  await app.profile.visit();
  await app.signIn.expectLoaded();
});

test("LOGIN-032 E-AUTH-10: clicking your name in the header opens /profile", async ({ app, createdUser }) => {
  await app.header.openProfileByName(createdUser.name);

  await app.profile.expectLoaded();
  await app.profile.expectEmail(createdUser.email);
});

test("LOGIN-071: sign in and reach the profile", async ({ unauthorizedUserApp: app, createdUser }) => {
  await app.signIn.signInFromScratch(createdUser);

  await app.profile.open();

  await app.profile.expectEmail(createdUser.email);
});

test("LOGIN-072: the user's name in the header leads to the profile, addresses and all", async ({ unauthorizedUserApp: app, createdUser }) => {
  await app.signIn.signInFromScratch(createdUser);

  await app.header.openProfileByName(createdUser.name);

  await app.profile.expectLoaded();
  await app.profile.expectAddressSection();
});

test("LOGIN-073: an unauthenticated visit to /profile lands on sign-in", async ({ unauthorizedUserApp: app }) => {
  await app.profile.visit();

  await app.signIn.expectLoaded();
});
