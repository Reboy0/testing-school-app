/**
 * Validation in the browser (suite VAL, VAL-17 group): each form, fed an
 * invalid value through the real UI and API, shows the error beside the
 * field it belongs to, marks that field invalid, and does not move on.
 */
import { test } from "../../fixture/test";
import { withIds } from "../../utils/ids";

for (const [id, email, why] of withIds("VAL-229", "VAL-232", [
  ["plainaddress", "no @"],
  ["ada@", "no domain"],
  ["ada@example", "no top-level domain"],
  ["ada example@example.com", "a space"],
])) {
  test(`${id}: the email ${JSON.stringify(email)} (${why}) is reported beside the email field and nothing is created`, async ({ unauthorizedUserApp: { register } }) => {
    await register.open();
    await register.fill({ email, name: "Ada", password: "Abcdefghi1" });
    await register.submit();

    await register.expectEmailError("Enter a valid email address");
    await register.expectLoaded();
  });
}

for (const [id, password, message] of withIds("VAL-233", "VAL-236", [
  ["Abcdefgh1", "Password must be at least 10 characters"],
  ["abcdefghi1", "Password must contain an uppercase letter"],
  ["ABCDEFGHI1", "Password must contain a lowercase letter"],
  ["Abcdefghij", "Password must contain a digit"],
])) {
  test(`${id}: the password ${JSON.stringify(password)} is reported beside the password field: ${message}`, async ({ unauthorizedUserApp: { register }, testData }) => {
    await register.open();
    await register.fill({ ...testData.user("val-password"), password });
    await register.submit();

    await register.expectPasswordError(message);
    await register.expectLoaded();
  });
}

test("VAL-237: an empty form reports email, name and password, each beside its own field", async ({ unauthorizedUserApp: { register } }) => {
  await register.open();
  await register.submit();

  await register.expectEveryFieldReported();
});

test("VAL-238: sign-in and forgot-password report an invalid email beside the email field", async ({ unauthorizedUserApp: app }) => {
  await app.signIn.open();
  await app.signIn.signIn({ email: "not-an-email", password: "anything" });
  await app.signIn.expectEmailError("Enter a valid email address");

  await app.forgotPassword.open();
  await app.forgotPassword.requestReset("not-an-email");
  await app.forgotPassword.expectEmailError("Enter a valid email address");
  await app.forgotPassword.expectNoConfirmation();
});

test("VAL-239: the profile form reports a too-short phone and an empty name beside their fields", async ({ app }) => {
  await app.profile.open();

  await app.profile.saveProfile({ name: "", phone: "123" });

  await app.profile.expectPhoneError("Enter a valid phone number");
  await app.profile.expectNameError("Name is required");
});

test("VAL-240: the address form reports every empty field and a bad country code beside each, and saves nothing", async ({ app }) => {
  await app.profile.open();

  await app.profile.addAddress({ country: "UKR" });

  for (const name of ["label", "line1", "city", "postalCode"]) await app.profile.expectAddressFieldError(name);
  await app.profile.expectAddressFieldError("country", "Use a two-letter country code");
  await app.profile.expectNoAddressesSaved();
});
