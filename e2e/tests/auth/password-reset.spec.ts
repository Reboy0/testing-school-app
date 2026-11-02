/**
 * Password reset by email link (suite PWD, plan rows E-AUTH-06…08, and the
 * legacy check PWD-034). The links come from Maildev; every account is new.
 */
import { ApiClient } from "../../api";
import { Application } from "../../app";
import { expect, test } from "../../fixture/test";
import { Tag } from "../../tags";
import { resetLinkFor, tokenOf } from "../../utils/mail";

const NEW_PASSWORD = "BrandNewPass1";

test("PWD-004 E-AUTH-06: forgot password → email in Maildev → link → new password → the new one signs in and the old one does not", { tag: Tag.Smoke }, async ({ unauthorizedUserApp: app, createdUser }) => {
  await app.forgotPassword.open();
  await app.forgotPassword.requestReset(createdUser.email);
  await app.forgotPassword.expectConfirmation();

  await app.resetPassword.openLink(await resetLinkFor(createdUser.email));
  await app.resetPassword.setNewPassword(NEW_PASSWORD);
  await app.signIn.expectUrl("/login");

  await app.signIn.signIn(createdUser);
  await app.signIn.expectFormError("Email or password is incorrect");

  await app.signIn.signIn({ email: createdUser.email, password: NEW_PASSWORD });
  await app.home.expectLoaded();
});

test("PWD-010 E-AUTH-07: following the same reset link a second time is refused", async ({ unauthorizedUserApp: app, createdUser, api }) => {
  await api.forgotPassword(createdUser.email);
  const link = await resetLinkFor(createdUser.email);

  await app.resetPassword.openLink(link);
  await app.resetPassword.setNewPassword(NEW_PASSWORD);
  await app.signIn.expectUrl("/login");

  await app.resetPassword.openLink(link);
  await app.resetPassword.setNewPassword("SecondNewPass2");

  await app.resetPassword.expectFormError("This reset link is no longer valid");
  await app.resetPassword.expectLoaded();
});

test("PWD-012 E-AUTH-08: resetting the password in one browser ends the session in another", async ({ browser, createdUser, api }) => {
  const otherContext = await browser.newContext();
  const otherPage = await otherContext.newPage();
  const other = new Application(otherPage);
  await other.signIn.signInFromScratch(createdUser);

  await api.forgotPassword(createdUser.email);
  expect(await api.resetPassword(tokenOf(await resetLinkFor(createdUser.email)), NEW_PASSWORD)).toBe(204);

  // The other browser can no longer renew its session…
  expect(await new ApiClient(otherPage.request).refresh()).toBe(401);
  // …so once its 15-minute access token lapses it is signed out.
  await otherContext.clearCookies({ name: "access_token" });
  await other.profile.visit();
  await other.signIn.expectLoaded();
  await otherContext.close();
});

test("PWD-034: reset the password by email link, sign in with the new one", async ({ unauthorizedUserApp: app, createdUser }) => {
  await app.forgotPassword.open();
  await app.forgotPassword.requestReset(createdUser.email);
  await app.forgotPassword.expectConfirmation();

  await app.resetPassword.openLink(await resetLinkFor(createdUser.email));
  await app.resetPassword.setNewPassword(NEW_PASSWORD);
  await app.signIn.expectUrl("/login");

  await app.signIn.signIn({ email: createdUser.email, password: NEW_PASSWORD });
  await app.home.expectLoaded();
});
